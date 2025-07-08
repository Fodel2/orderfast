export default function Home() {
  return (
    <main className="p-6 text-center">
      <h1 className="text-3xl font-bold">Welcome to OrderFast</h1>
      <p className="mt-2">Self-ordering & Online Ordering Platform for Restaurants</p>
      <a href="/signup" className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded">Get Started</a>
       <div className="mt-4 space-x-4">
        <a
          href="/signup"
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded"
        >
          Sign Up
        </a>
        <a
          href="/login"
          className="inline-block px-4 py-2 border border-blue-600 text-blue-600 rounded"
        >
          Log In
        </a>
      </div>
    </main>
  );
}