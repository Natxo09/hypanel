import { HardDrive } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";

export function BackupsView() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Backups" />

      <div className="flex-1 overflow-y-auto p-4">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <HardDrive className="h-12 w-12 mb-4 text-muted-foreground" />
            <p className="text-base font-medium mb-1">Backups</p>
            <p className="text-sm text-muted-foreground">Coming soon...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
