import { createClient } from '@/lib/supabase/server'

export async function getProfile() {
  const supabase = await createClient()

  // Verify the user's authentication token
  const { data, error: authError } =
    await supabase.auth.getClaims()

  const userId = data?.claims?.sub

  if (authError || !userId) {
    return null
  }

  // Retrieve the user's staff profile
  const { data: profile, error: profileError } =
    await supabase
      .from('profiles')
      .select('user_id, full_name, role, is_active')
      .eq('user_id', userId)
      .single()

  if (profileError || !profile || !profile.is_active) {
    return null
  }

  return profile
}
