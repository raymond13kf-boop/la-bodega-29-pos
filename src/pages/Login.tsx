import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Store, User, Lock } from 'lucide-react';
import './Login.css';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username || !password) {
      setError('Por favor, ingresa tu usuario y contraseña.');
      return;
    }

    const res = await login(username, password);
    if (res.success) {
      navigate('/');
    } else {
      setError(res.error || 'Error al iniciar sesión');
    }
  };

  return (
    <div className="login-container">
      <Card className="login-card">
        <CardHeader className="login-header">
          <div className="login-logo">
            <Store size={32} />
          </div>
          <CardTitle>La Bodega 29</CardTitle>
          <p className="login-subtitle">Sistema de Punto de Venta</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="login-form">
            <Input 
              label="Usuario" 
              placeholder="Ej: raymond" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              icon={<User size={18} />}
              fullWidth
            />
            <Input 
              label="Contraseña" 
              type="password" 
              placeholder="••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock size={18} />}
              fullWidth
            />
            {error && <div className="login-error-msg">{error}</div>}
            <Button 
              type="submit" 
              fullWidth 
              size="lg" 
              disabled={isLoading}
              className="login-btn"
            >
              {isLoading ? 'Iniciando...' : 'Ingresar al Sistema'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
