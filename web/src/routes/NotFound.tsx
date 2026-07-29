import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <section className="text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="mt-4 inline-block text-blue-600 hover:underline">
        Back to store
      </Link>
    </section>
  );
}
