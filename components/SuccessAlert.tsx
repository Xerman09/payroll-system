import { CircleCheckIcon } from "lucide-react";

export default function component() {
  return (
    <div className="rounded-md border border-eborder px-4 py-3 bg-green-100">
      <p className="text-sm">
        <CircleCheckIcon
          aria-hidden="true"
          className="-mt-0.5 me-3 inline-flex text-emerald-500"
          size={16}
        />
        Logged In successfully!
      </p>
    </div>
  );
}
