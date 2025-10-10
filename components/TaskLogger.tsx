import { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

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
    <Card className="p-4 space-y-4 shadow-sm rounded-2xl">
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
          onValueChange={(value) => setNewTask({ ...newTask, urgency: value as Task["urgency"] })}
        >
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Urgency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>

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
              <div className="flex gap-2 mt-1">
                <Badge variant={task.urgency === "urgent" ? "destructive" : "secondary"}>
                  {task.urgency}
                </Badge>
                <Select
                  value={task.status}
                  onValueChange={(value) => updateTask(task.id, { status: value as Task["status"] })}
                >
                  <SelectTrigger className="w-28 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="waiting">Waiting</SelectItem>
                    <SelectItem value="in-process">In Process</SelectItem>
                    <SelectItem value="complete">Complete</SelectItem>
                  </SelectContent>
                </Select>
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
