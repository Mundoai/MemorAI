"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Bookmark } from "lucide-react";
import { toast } from "sonner";

interface MemoryActionsProps {
  memoryId: string;
}

export function MemoryActions({ memoryId }: MemoryActionsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this memory?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/memories/${memoryId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Memory deleted");
      router.push("/memories");
    } catch {
      toast.error("Failed to delete memory");
    } finally {
      setDeleting(false);
    }
  }

  async function handleBookmark() {
    try {
      const res = await fetch(`/api/memories/${memoryId}/bookmark`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to bookmark");
      toast.success("Bookmark toggled");
      router.refresh();
    } catch {
      toast.error("Failed to toggle bookmark");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleBookmark}>
        <Bookmark className="mr-2 h-4 w-4" />
        Bookmark
      </Button>
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDelete}
        disabled={deleting}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        {deleting ? "Deleting..." : "Delete"}
      </Button>
    </div>
  );
}
