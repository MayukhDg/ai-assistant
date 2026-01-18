import SignupForm from '@/components/auth/SignupForm'

// Force dynamic rendering to avoid build-time env var issues
export const dynamic = 'force-dynamic'

export default function SignupPage() {
  return <SignupForm />
}
