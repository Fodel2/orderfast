import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
} from "react";
import { supabase } from "@/utils/supabaseClient";
import { useRestaurant } from "@/lib/restaurant-context";

const cardBaseClasses =
  "bg-white/95 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-lg backdrop-blur";

const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`${cardBaseClasses} ${className}`}>
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
  id: string;
  title: string;
  urgency: "normal" | "urgent";
  status: "waiting" | "in-process" | "complete";
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

type NewTask = Pick<Task, "title" | "urgency" | "status">;

const toTimestamp = (value: string | null | undefined) =>
  value ? new Date(value).getTime() : 0;

export default function TaskLogger() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [archived, setArchived] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState<NewTask>({
    title: "",
    urgency: "normal",
    status: "waiting",
  });
  const [initializing, setInitializing] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const { restaurantId: contextRestaurantId } = useRestaurant();

  const sortActiveTasks = useCallback((list: Task[]) => {
    const priority: Record<Task["status"], number> = {
      "in-process": 0,
      waiting: 1,
      complete: 2,
    };

    return [...list]
      .filter((task) => !task.archived_at)
      .sort((a, b) => {
        const statusDiff = priority[a.status] - priority[b.status];
        if (statusDiff !== 0) {
          return statusDiff;
        }

        const updatedDiff = toTimestamp(b.updated_at) - toTimestamp(a.updated_at);
        if (updatedDiff !== 0) {
          return updatedDiff;
        }

        return toTimestamp(b.created_at) - toTimestamp(a.created_at);
      });
  }, []);

  const sortArchivedTasks = useCallback(
    (list: Task[]) =>
      [...list]
        .filter((task) => task.archived_at)
        .sort(
          (a, b) =>
            (toTimestamp(b.archived_at) || toTimestamp(b.updated_at)) -
            (toTimestamp(a.archived_at) || toTimestamp(a.updated_at))
        ),
    []
  );

  const applyTask = useCallback(
    (task: Task) => {
      if (task.archived_at) {
        setTasks((previous) => previous.filter((existing) => existing.id !== task.id));
        setArchived((previous) =>
          sortArchivedTasks([task, ...previous.filter((existing) => existing.id !== task.id)])
        );
        return;
      }

      setArchived((previous) => previous.filter((existing) => existing.id !== task.id));
      setTasks((previous) =>
        sortActiveTasks([task, ...previous.filter((existing) => existing.id !== task.id)])
      );
    },
    [sortActiveTasks, sortArchivedTasks]
  );

  const refreshTasks = useCallback(
    async (rid: string) => {
      setRefreshing(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/dashboard/tasks?restaurantId=${encodeURIComponent(rid)}`
        );
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Failed to load tasks");
        }
        const payload = (await response.json()) as { active: Task[]; archived: Task[] };
        setTasks(sortActiveTasks(payload.active ?? []));
        setArchived(sortArchivedTasks(payload.archived ?? []));
      } catch (caught) {
        console.error("Failed to load dashboard tasks", caught);
        setError("Unable to load tasks. Please try again.");
      } finally {
        setRefreshing(false);
      }
    },
    [sortActiveTasks, sortArchivedTasks]
  );

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setInitializing(true);
      setError(null);
      try {
        let resolvedRestaurantId = contextRestaurantId ?? null;

        if (!resolvedRestaurantId) {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (!session) {
            if (!cancelled) {
              setRestaurantId(null);
              setTasks([]);
              setArchived([]);
              setError("Please sign in to manage tasks.");
            }
            return;
          }

          const { data: membershipRows, error: membershipError } = await supabase
            .from("restaurant_users")
            .select("restaurant_id")
            .eq("user_id", session.user.id)
            .limit(1);

          if (membershipError) {
            throw membershipError;
          }

          resolvedRestaurantId =
            (membershipRows as { restaurant_id: string }[] | null)?.[0]?.restaurant_id ?? null;

          if (!resolvedRestaurantId) {
            const { data: ownedRows, error: ownedError } = await supabase
              .from("restaurants")
              .select("id")
              .eq("owner_id", session.user.id)
              .limit(1);

            if (ownedError) {
              throw ownedError;
            }

            resolvedRestaurantId = (ownedRows as { id: string }[] | null)?.[0]?.id ?? null;
          }
        }

        if (!resolvedRestaurantId) {
          if (!cancelled) {
            setRestaurantId(null);
            setTasks([]);
            setArchived([]);
            setError("No restaurant assigned yet. Ask an admin to invite you.");
          }
          return;
        }

        if (cancelled) return;

        setRestaurantId(resolvedRestaurantId);
        await refreshTasks(resolvedRestaurantId);
      } catch (caught) {
        console.error("Failed to initialise dashboard tasks", caught);
        if (!cancelled) {
          setError("Unable to load tasks right now.");
        }
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [contextRestaurantId, refreshTasks]);

  const addTask = async () => {
    if (!restaurantId || !newTask.title.trim()) return;
    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/dashboard/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          title: newTask.title.trim(),
          urgency: newTask.urgency,
          status: newTask.status,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to create task");
      }

      const payload = (await response.json()) as { task: Task };
      applyTask(payload.task);
      setNewTask({ title: "", urgency: "normal", status: "waiting" });
    } catch (caught) {
      console.error("Failed to create dashboard task", caught);
      setError("Could not save the task. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const updateTask = async (
    id: string,
    updates: Partial<Pick<Task, "title" | "status" | "urgency">>,
    archive = false
  ) => {
    if (!restaurantId) return;
    setSavingTaskId(id);
    setError(null);
    try {
      const response = await fetch("/api/dashboard/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, id, updates, archive }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to update task");
      }

      const payload = (await response.json()) as { task: Task };
      applyTask(payload.task);
    } catch (caught) {
      console.error("Failed to update dashboard task", caught);
      setError("Could not update the task. Please try again.");
    } finally {
      setSavingTaskId(null);
    }
  };

  const completeTask = (id: string) => {
    void updateTask(id, { status: "complete" }, true);
  };

  const canManage = Boolean(restaurantId) && !initializing;
  const disableNewTask = !canManage || isCreating;

  return (
    <Card className="p-0 space-y-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Task Logger</h2>
          <Badge variant="secondary">Auto-sync</Badge>
        </div>
      </CardHeader>

      {/* Add Task */}
      <CardContent className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="New task..."
          value={newTask.title}
          onChange={(event) => setNewTask({ ...newTask, title: event.target.value })}
          className="flex-1"
          disabled={disableNewTask}
        />
        <Select
          value={newTask.urgency}
          onChange={(value) => setNewTask({ ...newTask, urgency: value as Task["urgency"] })}
          options={[
            { value: "normal", label: "Normal" },
            { value: "urgent", label: "Urgent" },
          ]}
          className="w-28"
          disabled={disableNewTask}
        />

        <Button
          onClick={addTask}
          disabled={disableNewTask || !newTask.title.trim()}
        >
          {isCreating ? "Saving..." : "Add"}
        </Button>
      </CardContent>

      <CardContent className="pt-0 -mt-4 text-xs text-muted-foreground">
        {restaurantId
          ? "Tasks sync automatically for everyone on this restaurant."
          : "Assign a restaurant to start logging work."}
      </CardContent>

      {error && (
        <CardContent className="pt-0 -mt-2 text-sm text-red-500">{error}</CardContent>
      )}

      {/* Task List */}
      <CardContent className="space-y-3">
        {initializing && tasks.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center">Loading tasks…</p>
        ) : tasks.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center">No active tasks</p>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between border border-gray-200 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-900/60 p-3 rounded-xl shadow-sm"
            >
              <div className="flex flex-col">
                <span className="font-medium">{task.title}</span>
                <div className="flex gap-2 mt-1 items-center">
                  <Badge variant={task.urgency === "urgent" ? "destructive" : "secondary"}>
                    {task.urgency}
                  </Badge>
                  <Select
                    value={task.status}
                    onChange={(value) =>
                      updateTask(task.id, { status: value as Task["status"] }, value === "complete")
                    }
                    options={[
                      { value: "waiting", label: "Waiting" },
                      { value: "in-process", label: "In Process" },
                      { value: "complete", label: "Complete" },
                    ]}
                    className="w-36 text-xs"
                    disabled={savingTaskId === task.id || !canManage}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => completeTask(task.id)}
                  disabled={savingTaskId === task.id || !canManage}
                >
                  ✓
                </Button>
              </div>
            </div>
          ))
        )}

        {refreshing && !initializing && (
          <p className="text-muted-foreground text-xs text-center">Syncing latest updates…</p>
        )}
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
