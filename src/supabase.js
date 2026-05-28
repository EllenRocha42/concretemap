import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://rfkdwtegnyvbtfvwjkfa.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJma2R3dGVnbnl2YnRmdndqa2ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTIzOTUsImV4cCI6MjA5NTU2ODM5NX0.Kr7PwV6PM_H5uHJP5kUGiE0ebK8QYhT3wSD3ApFIHCs'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
