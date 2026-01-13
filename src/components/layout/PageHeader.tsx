import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  backButton?: boolean;
  onBack?: () => void;
  children?: React.ReactNode;
}

export function PageHeader({ title, backButton, onBack, children }: PageHeaderProps) {
  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Header content */}
      <div className="flex h-12 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          {backButton && (
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onBack}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          <h1 className="text-lg font-semibold">{title}</h1>
        </div>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    </div>
  );
}
