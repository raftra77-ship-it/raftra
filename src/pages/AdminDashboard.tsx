import React, { useState, useEffect } from 'react';
import { Users2, CreditCard, UserPlus, Cpu } from 'lucide-react';
import '../App.css';

interface User {
  id: string;
  email: string;
  status: 'active' | 'inactive';
  paymentStatus: 'paid' | 'pending';
}

export function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newUserEmail, setNewUserEmail] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('http://localhost:8005/api/auth/users');
        if (response.ok) {
          const data = await response.json();
          const formattedUsers = data.map((u: any) => ({
            id: u.id.toString(),
            email: u.email,
            status: u.is_active ? 'active' : 'inactive',
            paymentStatus: 'pending' // Real payment tracking will go here
          }));
          setUsers(formattedUsers);
        }
      } catch (error) {
        console.error("Failed to fetch users:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail) return;
    
    setUsers([...users, {
      id: Date.now().toString(),
      email: newUserEmail,
      status: 'active',
      paymentStatus: 'pending'
    }]);
    setNewUserEmail('');
  };

  return (
    <div className="dashboard-container" style={{ background: 'var(--bg-primary)', minHeight: '100vh', color: 'white', display: 'flex', flexDirection: 'column' }}>
      <header className="dashboard-header" style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Cpu className="logo-icon" size={20} />
          <span style={{ fontWeight: 800, fontSize: '15px', fontFamily: 'var(--font-heading)' }}>
            ADMIN CONTROL PANEL
          </span>
        </div>
      </header>

      <main style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-heading)', marginBottom: '24px' }}>System Administration</h1>
        
        <div className="metrics-row" style={{ marginBottom: '32px' }}>
          <div className="metric-widget">
            <span className="metric-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Users2 size={14}/> TOTAL USERS</span>
            <span className="metric-value">{users.length}</span>
          </div>
          <div className="metric-widget">
            <span className="metric-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CreditCard size={14}/> ACTIVE SUBSCRIPTIONS</span>
            <span className="metric-value">{users.filter(u => u.paymentStatus === 'paid').length}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
          {/* Users List */}
          <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)', padding: '20px' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '16px', fontFamily: 'var(--font-heading)' }}>Registered Users</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {isLoading ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Retrieving active user records...</div>
              ) : users.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No registered users.</div>
              ) : (
                users.map(user => (
                  <div key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '14px', fontFamily: 'var(--font-mono)' }}>{user.email}</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span className="hero-pill-badge" style={{ background: user.status === 'active' ? 'var(--success-glow)' : 'var(--border)', color: user.status === 'active' ? 'var(--success)' : 'var(--text-secondary)' }}>
                        {user.status}
                      </span>
                      <span className="hero-pill-badge" style={{ background: user.paymentStatus === 'paid' ? 'var(--accent-glow)' : 'var(--warning-glow)', color: user.paymentStatus === 'paid' ? 'var(--accent)' : 'var(--warning)' }}>
                        {user.paymentStatus}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Add User Panel */}
          <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)', padding: '20px', height: 'fit-content' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '16px', fontFamily: 'var(--font-heading)' }}>Add New User</h2>
            <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>User Email</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="agent@domain.com"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'white', outline: 'none' }}
                  required
                />
              </div>
              <button type="submit" className="glow-button" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', padding: '10px' }}>
                <UserPlus size={16} /> Add User
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
