"use client";

import * as Dialog from "@radix-ui/react-dialog";

/**
 * The bottom sheet — doc 04 §5.6.
 *
 * Radix, not hand-rolled: focus trap, Esc, scroll lock and focus restoration are
 * each easy to get subtly wrong, and DECISIONS B1 permits exactly this one
 * dependency for exactly this reason. Everything else here is plain CSS.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="backdrop" />
        <Dialog.Content className="sheet" aria-describedby={description ? undefined : ""}>
          <span className="grab" aria-hidden="true" />
          <Dialog.Title className="t-card">{title}</Dialog.Title>
          {description && <Dialog.Description className="t-sec">{description}</Dialog.Description>}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
