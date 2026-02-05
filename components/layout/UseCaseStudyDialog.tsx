"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type UseCaseStudyDialogProps = {
  title: string;
  summary: string;
  takeaways: string[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function UseCaseStudyDialog({
  title,
  summary,
  takeaways,
  open,
  onOpenChange,
}: UseCaseStudyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="w-[50%] rounded-full bg-[#E6C8A3] text-[#171717] hover:bg-[#E6C8A3]/85"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          See a study case
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl p-10">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          {takeaways.map((item, i) => (
            <div key={i} className="flex gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-[#E6C8A3]" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
