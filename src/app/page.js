import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="px-4 py-6">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-2xl font-bold text-gray-900">
            🎙️ AI Receptionist
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/login"
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 py-16 sm:py-24">
        <div className="text-center">
          <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 leading-tight">
            Never Miss a Call.<br />
            <span className="text-blue-600">Book More Appointments.</span>
          </h1>
          <p className="mt-6 text-xl text-gray-600 max-w-2xl mx-auto">
            AI-powered voice receptionist that answers calls 24/7, 
            books appointments, and handles customer inquiries for your business.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all"
            >
              Start Free Trial
            </Link>
            <Link
              href="#features"
              className="px-8 py-4 border-2 border-gray-300 text-gray-700 text-lg font-semibold rounded-lg hover:border-gray-400 transition-all"
            >
              Learn More
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600">2.5x</div>
            <div className="mt-2 text-gray-600">More Bookings</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600">24/7</div>
            <div className="mt-2 text-gray-600">Availability</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600">60%</div>
            <div className="mt-2 text-gray-600">Higher Pickup Rate</div>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section id="features" className="bg-white py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Everything You Need
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="text-3xl mb-4">📞</div>
              <h3 className="text-xl font-semibold text-gray-900">Smart Call Handling</h3>
              <p className="mt-2 text-gray-600">
                AI answers calls naturally, understands intent, and handles bookings, 
                cancellations, and common questions.
              </p>
            </div>
            
            <div className="p-6 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="text-3xl mb-4">📅</div>
              <h3 className="text-xl font-semibold text-gray-900">Real-Time Booking</h3>
              <p className="mt-2 text-gray-600">
                Checks your availability instantly and books appointments 
                directly into your calendar. No double-bookings.
              </p>
            </div>
            
            <div className="p-6 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="text-3xl mb-4">💬</div>
              <h3 className="text-xl font-semibold text-gray-900">SMS Confirmations</h3>
              <p className="mt-2 text-gray-600">
                Automatically sends booking confirmations and reminders 
                to reduce no-shows.
              </p>
            </div>
            
            <div className="p-6 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="text-3xl mb-4">🔄</div>
              <h3 className="text-xl font-semibold text-gray-900">Human Handoff</h3>
              <p className="mt-2 text-gray-600">
                Seamlessly transfers complex calls to your staff when needed. 
                AI knows its limits.
              </p>
            </div>
            
            <div className="p-6 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="text-3xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-gray-900">Call Analytics</h3>
              <p className="mt-2 text-gray-600">
                Track every call, see transcripts, and understand 
                what your customers are asking for.
              </p>
            </div>
            
            <div className="p-6 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="text-3xl mb-4">⚙️</div>
              <h3 className="text-xl font-semibold text-gray-900">Easy Setup</h3>
              <p className="mt-2 text-gray-600">
                Configure your working hours, services, and AI personality 
                in minutes. No coding required.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Simple, Usage-Based Pricing
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Pay only for successful bookings or handled calls. No monthly minimums.
          </p>
          <Link
            href="/signup"
            className="inline-block px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 shadow-lg"
          >
            Start Your Free Trial
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="text-xl font-bold text-white mb-4 md:mb-0">
              🎙️ AI Receptionist
            </div>
            <div className="flex space-x-6">
              <Link href="/privacy" className="hover:text-white">Privacy</Link>
              <Link href="/terms" className="hover:text-white">Terms</Link>
              <a href="mailto:support@example.com" className="hover:text-white">Contact</a>
            </div>
          </div>
          <div className="mt-8 text-center text-sm">
            © {new Date().getFullYear()} AI Receptionist. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
