import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ZoomInIcon } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./sheet";
import { Toaster } from "./sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

function DialogOfSize({ size }: { readonly size: "default" | "lg" }) {
  return (
    <Dialog defaultOpen>
      <DialogContent size={size}>
        <DialogHeader>
          <DialogTitle>Run Daily digest</DialogTitle>
          <DialogDescription>
            The run uses the version you choose and the input below.
          </DialogDescription>
        </DialogHeader>
        <p>Version 1.2.0, published yesterday.</p>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Run</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Toasts() {
  useEffect(() => {
    toast.success("Version 1.2.0 published");
    toast.error("The run failed: the server answered 502");
    toast("Post the items deleted", {
      action: { label: "Undo", onClick: () => undefined },
      duration: Infinity,
    });
  }, []);

  return <Toaster />;
}

const meta = {
  title: "Design system/Components/Overlays",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const DialogDefault: Story = {
  render: () => <DialogOfSize size="default" />,
};

export const DialogWide: Story = {
  render: () => <DialogOfSize size="lg" />,
};

export const AlertDialogNarrow: Story = {
  render: () => (
    <AlertDialog defaultOpen>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete the secret CRM_API_TOKEN?</AlertDialogTitle>
          <AlertDialogDescription>
            Workflows that use it will fail until they get another.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};

export const SidePanel: Story = {
  render: () => (
    <Sheet defaultOpen>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Test run</SheetTitle>
          <SheetDescription>
            Runs the draft without publishing it.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
};

export const Menu: Story = {
  render: () => (
    <div className="p-6">
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Daily digest</DropdownMenuLabel>
          <DropdownMenuItem>Rename</DropdownMenuItem>
          <DropdownMenuItem>Duplicate</DropdownMenuItem>
          <DropdownMenuItem disabled>Move</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">Delete…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ),
};

export const PopoverAndTooltip: Story = {
  render: () => (
    <TooltipProvider delayDuration={300}>
      <div className="flex gap-24 p-6">
        <Popover defaultOpen>
          <PopoverTrigger asChild>
            <Button variant="outline">Insert data</Button>
          </PopoverTrigger>
          <PopoverContent align="start">
            <p className="font-semibold">Workflow input</p>
            <p className="text-muted-foreground">Fields the run starts with.</p>
          </PopoverContent>
        </Popover>
        <Tooltip defaultOpen>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Zoom in">
              <ZoomInIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom in</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  ),
};

export const Toast: Story = {
  render: () => <Toasts />,
};
