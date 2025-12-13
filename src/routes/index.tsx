import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to YipYaps
        </h1>
        <p className="text-gray-600">
          Get started by editing <code className="px-2 py-1 bg-gray-200 rounded">src/routes/index.tsx</code>
        </p>
      </div>
    </div>
  )
}
