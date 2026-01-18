import LoginForm from '@/components/auth/LoginForm'

// Force dynamic rendering to avoid build-time env var issues
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return <LoginForm />
}
