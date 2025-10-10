import {
  useEffect,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
} from "react";

const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div
    className={`bg-white/95 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-lg backdrop-blur ${className}`}
  >
    {children}
  </div>
);

const CardHeader = ({ children }: { children: ReactNode }) => (
  <div className="border-b border-gray-200 dark:border-slate-700 bg-gray-50/90 dark:bg-slate-800/70 p-4 font-semibold text-gray-900 dark:text-gray-50 rounded-t-2xl">
    {children}
  </div>
);

const CardContent = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`p-4 text-gray-800 dark:text-gray-100 ${className}`}>{children}</div>
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
  const base =
    "rounded-lg font-medium transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 disabled:cursor-not-allowed";
  const variants: Record<ButtonVariant, string> = {
    default: "bg-primary text-white hover:bg-primary/90",
    outline: "border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-100",
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
    className={`border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900/70 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-gray-400 dark:placeholder:text-slate-400 ${className}`}
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
    className={`border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-2 text-sm bg-white/95 dark:bg-slate-900/70 ${className}`}
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
      ? "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-200"
      : variant === "outline"
      ? "border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-200"
      : variant === "secondary"
      ? "bg-gray-200 text-gray-700 dark:bg-slate-700/60 dark:text-gray-100"
      : "bg-gray-100 text-gray-700 dark:bg-slate-800/70 dark:text-gray-100";

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

  const sortTaskList = (list: Task[]) => {
    const priority: Record<Task["status"], number> = {
      "in-process": 0,
      waiting: 1,
      complete: 2,
    };

    return [...list].sort((a, b) => {
      const statusDiff = priority[a.status] - priority[b.status];
      if (statusDiff !== 0) {
        return statusDiff;
      }

      return b.id - a.id;
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedActive = window.localStorage.getItem("task-logger-active");
    const storedArchive = window.localStorage.getItem("task-logger-archive");

    if (storedActive) {
      try {
        const parsed: Task[] = JSON.parse(storedActive);
        setTasks(sortTaskList(parsed));
      } catch (error) {
        console.error("Failed to parse stored tasks", error);
      }
    }

    if (storedArchive) {
      try {
        const parsed: Task[] = JSON.parse(storedArchive);
        setArchived(parsed);
      } catch (error) {
        console.error("Failed to parse stored archived tasks", error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("task-logger-active", JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("task-logger-archive", JSON.stringify(archived));
  }, [archived]);

  const addTask = () => {
    if (!newTask.title.trim()) return;
    setTasks((previous) => sortTaskList([...previous, { ...newTask, id: Date.now() }]));
    setNewTask({ title: "", urgency: "normal", status: "waiting" });
  };

  const updateTask = (id: number, updates: Partial<Task>) => {
    setTasks((previous) =>
      sortTaskList(previous.map((task) => (task.id === id ? { ...task, ...updates } : task)))
    );
  };

  const completeTask = (id: number) => {
    const done = tasks.find((task) => task.id === id);
    if (!done) return;

    setArchived((previous) => [{ ...done, status: "complete" }, ...previous]);
    setTasks((previous) => previous.filter((task) => task.id !== id));
  };

  return (
    <Card className="p-0 space-y-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Task Logger</h2>
          <Badge variant="outline">Local Draft</Badge>
        </div>
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

      <CardContent className="pt-0 -mt-4 text-xs text-muted-foreground">
        Tasks are stored locally in your browser so you can iterate quickly before logging official work.
      </CardContent>

      {/* Task List */}
      <CardContent className="space-y-3">
        {tasks.length === 0 && (
          <p className="text-muted-foreground text-sm text-center">No active tasks</p>
        )}

        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center justify-between border border-gray-200 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-900/60 p-3 rounded-xl shadow-sm"
          >
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
                  className="w-36 text-xs"
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
