"use client";

import { useRefData } from "@/lib/hooks";
import type { WorkEntry } from "@/lib/types";
import { EntryForm } from "./entry-form";
import { Modal } from "./ui";

/** Add or edit an entry from anywhere (dashboard, calendar, history, projects). */
export function EntryModal({
  open,
  onClose,
  entry,
  date,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  entry?: WorkEntry | null;
  date: string;
  onSaved: () => void;
}) {
  const ref = useRefData();
  return (
    <Modal open={open} onClose={onClose} title={entry ? "Edit work entry" : "Add work entry"}>
      {open && (
        <EntryForm
          key={entry?.id ?? `new-${date}`}
          date={date}
          entry={entry}
          refData={ref.data}
          onRefDataChange={ref.reload}
          onCancel={onClose}
          onSaved={(_, mode) => {
            onSaved();
            if (mode === "close") onClose();
          }}
        />
      )}
    </Modal>
  );
}
