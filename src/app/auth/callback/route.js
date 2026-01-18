import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirect = searchParams.get('redirect') || '/dashboard'
  const newUser = searchParams.get('newUser') === 'true'
  
  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.session) {
      // Check if this is a new Google user who needs a business created
      if (newUser) {
        const { data: existingBusiness } = await supabase
          .from('businesses')
          .select('id')
          .eq('user_id', data.session.user.id)
          .single()
        
        if (!existingBusiness) {
          // Create a default business for new Google signups
          await supabase
            .from('businesses')
            .insert({
              user_id: data.session.user.id,
              name: data.session.user.user_metadata?.full_name || 'My Business',
              business_type: 'general'
            })
        }
      }
      
      return NextResponse.redirect(`${origin}${redirect}`)
    }
  }
  
  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
