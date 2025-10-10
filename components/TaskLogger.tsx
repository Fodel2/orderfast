import { useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";

const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`bg-white dark:bg-gray-900 border rounded-xl shadow-sm ${className}`}>{children}</div>
);

const CardHeader = ({ children }: { children: ReactNode }) => (
  <div className="border-b p-3 font-semibold">{children}</div>
);

const CardContent = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`p-3 ${className}`}>{children}</div>
);

type ButtonVariant = "default" | "outline" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

const Button = ({
  children,
  onClick,
  variant = "default",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonProps) => {
  const base = "rounded-lg font-medium transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50";
  const variants: Record<ButtonVariant, string> = {
    default: "bg-primary text-white hover:bg-primary/90",
    outline: "border border-gray-300 hover:bg-gray-50 text-gray-700",
    destructive: "bg-red-500 text-white hover:bg-red-600",
  };
  const sizes: Record<ButtonSize, string> = {
    sm: "px-2 py-1 text-sm",
    md: "px-3 py-2 text-sm",
    lg: "px-4 py-2 text-base",
  };

  return (
    <button onClick={onClick} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} type={type} {...props}>
      {children}
    </button>
  );
};

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

const Input = ({ className = "", ...props }: InputProps) => (
  <input
    {...props}
    className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${className}`}
  />
);

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
}

const Select = ({ value, onChange, options, className = "", ...props }: SelectProps) => (
  <select
    value={value}
    onChange={(event) => onChange(event.target.value)}
    className={`border rounded-lg px-2 py-1 text-sm bg-white dark:bg-gray-900 ${className}`}
    {...props}
  >
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary";
}

const Badge = ({ children, variant = "default" }: BadgeProps) => {
  const colors =
    variant === "destructive"
      ? "bg-red-100 text-red-600"
      : variant === "outline"
      ? "border border-gray-300 text-gray-600"
      : variant === "secondary"
      ? "bg-gray-200 text-gray-700"
      : "bg-gray-100 text-gray-700";

  return <span className={`text-xs font-medium px-2 py-1 rounded ${colors}`}>{children}</span>;
};

interface Task {
  id: number;
  title: string;
  urgency: "normal" | "urgent";
  status: "waiting" | "in-process" | "complete";
}

export default function TaskLogger() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [archived, setArchived] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState<Omit<Task, "id">>({
    title: "",
    urgency: "normal",
    status: "waiting",
  });

  const addTask = () => {
    if (!newTask.title.trim()) return;
    setTasks([...tasks, { ...newTask, id: Date.now() }]);
    setNewTask({ title: "", urgency: "normal", status: "waiting" });
  };

  const updateTask = (id: number, updates: Partial<Task>) => {
    setTasks(tasks.map((task) => (task.id === id ? { ...task, ...updates } : task)));
  };

  const completeTask = (id: number) => {
    const done = tasks.find((task) => task.id === id);
    if (!done) return;

    setArchived([{ ...done, status: "complete" }, ...archived]);
    setTasks(tasks.filter((task) => task.id !== id));
  };

  return (
    <Card className="p-4 space-y-4">
      <CardHeader>
        <h2 className="text-lg font-semibold">Task Logger</h2>
      </CardHeader>

      {/* Add Task */}
      <CardContent className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="New task..."
          value={newTask.title}
          onChange={(event) => setNewTask({ ...newTask, title: event.target.value })}
          className="flex-1"
        />
        <Select
          value={newTask.urgency}
          onChange={(value) => setNewTask({ ...newTask, urgency: value as Task["urgency"] })}
          options={[
            { value: "normal", label: "Normal" },
            { value: "urgent", label: "Urgent" },
          ]}
          className="w-28"
        />

        <Button onClick={addTask}>Add</Button>
      </CardContent>

      {/* Task List */}
      <CardContent className="space-y-2">
        {tasks.length === 0 && (
          <p className="text-muted-foreground text-sm text-center">No active tasks</p>
        )}

        {tasks.map((task) => (
          <div key={task.id} className="flex items-center justify-between border p-3 rounded-lg">
            <div className="flex flex-col">
              <span className="font-medium">{task.title}</span>
              <div className="flex gap-2 mt-1 items-center">
                <Badge variant={task.urgency === "urgent" ? "destructive" : "secondary"}>{task.urgency}</Badge>
                <Select
                  value={task.status}
                  onChange={(value) => updateTask(task.id, { status: value as Task["status"] })}
                  options={[
                    { value: "waiting", label: "Waiting" },
                    { value: "in-process", label: "In Process" },
                    { value: "complete", label: "Complete" },
                  ]}
                  className="w-32 text-xs py-1"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => completeTask(task.id)}>
                ✓
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      {/* Archive */}
      {archived.length > 0 && (
        <CardContent className="mt-6 border-t pt-4">
          <h3 className="font-semibold mb-2">Archive</h3>
          <div className="space-y-1">
            {archived.map((archive) => (
              <div
                key={archive.id}
                className="text-sm text-muted-foreground flex items-center justify-between"
              >
                <span>{archive.title}</span>
                <Badge variant="outline">Complete</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
