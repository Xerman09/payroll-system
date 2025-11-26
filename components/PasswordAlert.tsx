import { CircleAlertIcon } from "lucide-react";

export default function Component() {
  return (
    <div className="rounded-md border px-4 py-3">
      <div className="flex gap-3">
        <CircleAlertIcon
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-red-500 opacity-60"
          size={16}
        />
        <div className="grow space-y-1">
          <p className="font-medium text-sm">
            Your Email and Password Do Not Match!
          </p>
          <ul className=" text-muted-foreground text-sm">
            <li>Please try again</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
