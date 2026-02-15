"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { ImportModal } from "./ImportModal";
import type { EntityType } from "@/lib/import-utils";

interface ImportButtonProps {
  entityType: EntityType;
  entityLabel: string;
  onSuccess: () => void;
}

export function ImportButton({ entityType, entityLabel, onSuccess }: ImportButtonProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setShowModal(true)}>
        <Upload className="h-4 w-4 mr-2" />
        Import
      </Button>
      <ImportModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => {
          setShowModal(false);
          onSuccess();
        }}
        entityType={entityType}
        entityLabel={entityLabel}
      />
    </>
  );
}
