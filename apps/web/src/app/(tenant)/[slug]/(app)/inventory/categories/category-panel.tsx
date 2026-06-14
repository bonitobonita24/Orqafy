"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface CategoryPanelProps {
  categories: Category[];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Add Dialog ──────────────────────────────────────────────────────────────

function AddCategoryDialog({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setSlug("");
    setDescription("");
    setParentId("");
    setSortOrder("0");
    setError(null);
  }

  const create = trpc.inventory.categoryCreate.useMutation({
    onSuccess: () => {
      toast.success("Category created.");
      router.refresh();
      reset();
      setOpen(false);
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  function handleNameChange(v: string) {
    setName(v);
    if (slug === "" || slug === slugify(name)) {
      setSlug(slugify(v));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim() === "") {
      setError("Name is required.");
      return;
    }
    if (slug.trim() === "") {
      setError("Slug is required.");
      return;
    }
    create.mutate({
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() !== "" ? description.trim() : undefined,
      parentId: parentId !== "" ? parentId : undefined,
      sortOrder: parseInt(sortOrder, 10) || 0,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="rounded-md border border-[#00d992] bg-[#00d992]/10 px-3 py-2 text-sm font-medium text-[#00d992] hover:bg-[#00d992]/20"
        >
          + Add Category
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Category</DialogTitle>
          <DialogDescription>
            Create a product category to organise your inventory.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error !== null && (
            <p className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name *</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Office Supplies"
              disabled={create.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-slug">Slug *</Label>
            <Input
              id="cat-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g. office-supplies"
              disabled={create.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-desc">Description</Label>
            <Textarea
              id="cat-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              disabled={create.isPending}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cat-parent">Parent Category</Label>
              <Select
                value={parentId}
                onValueChange={(v) => setParentId(v === "__none__" ? "" : v)}
                disabled={create.isPending}
              >
                <SelectTrigger id="cat-parent">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-sort">Sort Order</Label>
              <Input
                id="cat-sort"
                type="number"
                min="0"
                step="1"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                disabled={create.isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              disabled={create.isPending}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-md border border-[#00d992] bg-[#00d992]/10 px-3 py-1.5 text-sm font-medium text-[#00d992] hover:bg-[#00d992]/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {create.isPending ? "Creating…" : "Create"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Dialog ─────────────────────────────────────────────────────────────

function EditCategoryDialog({
  category,
  categories,
}: {
  category: Category;
  categories: Category[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category.name);
  const [slug, setSlug] = useState(category.slug);
  const [description, setDescription] = useState(category.description ?? "");
  const [parentId, setParentId] = useState(category.parentId ?? "");
  const [sortOrder, setSortOrder] = useState(String(category.sortOrder));
  const [error, setError] = useState<string | null>(null);

  function resetToCategory() {
    setName(category.name);
    setSlug(category.slug);
    setDescription(category.description ?? "");
    setParentId(category.parentId ?? "");
    setSortOrder(String(category.sortOrder));
    setError(null);
  }

  const update = trpc.inventory.categoryUpdate.useMutation({
    onSuccess: () => {
      toast.success("Category updated.");
      router.refresh();
      setOpen(false);
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    update.mutate({
      id: category.id,
      name: name.trim() !== "" ? name.trim() : undefined,
      slug: slug.trim() !== "" ? slug.trim() : undefined,
      description: description.trim() !== "" ? description.trim() : undefined,
      parentId: parentId !== "" ? parentId : undefined,
      sortOrder: parseInt(sortOrder, 10) || 0,
    });
  }

  // Exclude self from parent options to avoid circular hierarchy
  const parentOptions = categories.filter((c) => c.id !== category.id);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetToCategory();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-xs text-muted-foreground transition-colors hover:text-[#00d992]"
        >
          Edit
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
          <DialogDescription>{category.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error !== null && (
            <p className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`edit-cat-name-${category.id}`}>Name</Label>
            <Input
              id={`edit-cat-name-${category.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={update.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`edit-cat-slug-${category.id}`}>Slug</Label>
            <Input
              id={`edit-cat-slug-${category.id}`}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={update.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`edit-cat-desc-${category.id}`}>Description</Label>
            <Textarea
              id={`edit-cat-desc-${category.id}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              disabled={update.isPending}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Parent Category</Label>
              <Select
                value={parentId}
                onValueChange={(v) => setParentId(v === "__none__" ? "" : v)}
                disabled={update.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {parentOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`edit-cat-sort-${category.id}`}>Sort Order</Label>
              <Input
                id={`edit-cat-sort-${category.id}`}
                type="number"
                min="0"
                step="1"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                disabled={update.isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                resetToCategory();
              }}
              disabled={update.isPending}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={update.isPending}
              className="rounded-md border border-[#00d992] bg-[#00d992]/10 px-3 py-1.5 text-sm font-medium text-[#00d992] hover:bg-[#00d992]/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {update.isPending ? "Saving…" : "Save"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Toggle Button ────────────────────────────────────────────────────────────

function CategoryToggle({ category }: { category: Category }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const toggle = trpc.inventory.categoryToggleActive.useMutation({
    onSuccess: () => {
      toast.success(
        category.isActive ? "Category deactivated." : "Category activated.",
      );
      setOpen(false);
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={`rounded-full border px-2 py-0.5 text-xs font-medium transition-colors hover:opacity-80 ${
            category.isActive
              ? "border-[#00d992]/30 bg-[#00d992]/10 text-[#00d992]"
              : "border-border bg-muted text-muted-foreground"
          }`}
        >
          {category.isActive ? "Active" : "Inactive"}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {category.isActive ? "Deactivate" : "Activate"} Category
          </DialogTitle>
          <DialogDescription>
            {category.isActive
              ? `Deactivating "${category.name}" will hide it from selection lists.`
              : `Activating "${category.name}" will make it available again.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={toggle.isPending}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate({ id: category.id })}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
              category.isActive
                ? "border-red-400/30 bg-red-400/10 text-red-400 hover:bg-red-400/20"
                : "border-[#00d992]/30 bg-[#00d992]/10 text-[#00d992] hover:bg-[#00d992]/20"
            }`}
          >
            {toggle.isPending
              ? "Saving…"
              : category.isActive
                ? "Deactivate"
                : "Activate"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Panel ───────────────────────────────────────────────────────────────

export function CategoryPanel({ categories }: CategoryPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {categories.filter((c) => c.isActive).length} active of{" "}
          {categories.length} total
        </p>
        <AddCategoryDialog categories={categories} />
      </div>

      <div className="rounded-lg border border-border bg-card">
        {categories.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No categories yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Parent</th>
                <th className="px-4 py-3 font-medium">Sort</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Edit</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => {
                const parent = categories.find((p) => p.id === c.parentId);
                return (
                  <tr
                    key={c.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {c.slug}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {parent !== undefined ? parent.name : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.sortOrder}
                    </td>
                    <td className="px-4 py-3">
                      <CategoryToggle category={c} />
                    </td>
                    <td className="px-4 py-3">
                      <EditCategoryDialog
                        category={c}
                        categories={categories}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
