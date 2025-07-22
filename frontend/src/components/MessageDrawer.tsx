import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

interface MessageDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  title?: string;
}

export function MessageDrawer({
  open,
  onOpenChange,
  message,
  title = "Full Message",
}: MessageDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="max-w-xl w-full bg-white shadow-xl ring-1 ring-black ring-opacity-5 rounded-l-2xl animate-slide-in-right border-l border-gray-200">
        <DrawerHeader className="border-b border-gray-200">
          <DrawerTitle className="text-xl font-semibold text-gray-900">
            {title}
          </DrawerTitle>
        </DrawerHeader>
        <div className="p-6 overflow-y-auto" style={{ maxHeight: "75vh" }}>
          <pre className="whitespace-pre-wrap text-base text-gray-800">
            {message}
          </pre>
        </div>
        <div className="px-6 pb-6">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
