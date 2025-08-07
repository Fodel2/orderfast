import { useEffect, useState } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import type { User } from '@supabase/supabase-js'

export function useUser() {
  const supabase = useSupabaseClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    const getUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (isMounted) {
        setUser(data.user)
        setLoading(false)
      }
    }
    getUser()
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [supabase])

  return { user, loading }
}

