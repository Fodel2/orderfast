import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitting signup...");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error("Signup error:", error.message);
      alert("Signup failed: " + error.message);
    } else {
      console.log("Signup success:", data);
      alert("Signup successful!");
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Create Account</h1>
      <form onSubmit={handleSignup}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <br /><br />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <br /><br />
        <button type="submit">Sign Up</button>
      </form>
    </div>
  );
}
