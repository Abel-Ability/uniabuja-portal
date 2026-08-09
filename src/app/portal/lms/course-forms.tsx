"use client";

import { useActionState } from "react";
import {
  registerCourse,
  dropCourse,
  type ModuleActionResult,
} from "@/lib/module-actions";
import { PillButton } from "@/components/ui";

function Feedback({ state }: { state: ModuleActionResult | null }) {
  if (!state) return null;
  if (state.ok) {
    return (
      <p role="status" className="mt-1 text-xs font-medium text-brand-dark">
        Done — synced to the LMS.
      </p>
    );
  }
  if (state.error) {
    return (
      <p role="alert" className="mt-1 text-xs font-medium text-red-600">
        {state.error}
      </p>
    );
  }
  return null;
}

export function RegisterCourseButton({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState(registerCourse, null);
  return (
    <form action={action}>
      <input type="hidden" name="courseId" value={courseId} />
      <PillButton
        type="submit"
        variant="outline"
        disabled={pending}
        className="px-4 py-1.5 text-xs"
      >
        {pending ? "Registering…" : "Register"}
      </PillButton>
      <Feedback state={state} />
    </form>
  );
}

export function DropCourseButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(dropCourse, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <PillButton
        type="submit"
        variant="outline"
        disabled={pending}
        className="px-4 py-1.5 text-xs"
      >
        {pending ? "Dropping…" : "Drop"}
      </PillButton>
      <Feedback state={state} />
    </form>
  );
}
