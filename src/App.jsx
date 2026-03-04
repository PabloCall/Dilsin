import { supabase } from './supabase'; // Adicione no topo
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  User, 
  Scissors, 
  ChevronRight, 
  LayoutDashboard, 
  Home, 
  ClipboardList, 
  CheckCircle2, 
  Menu, 
  X,
  Star,
  Trash2,
  Plus,
  Save,
  Edit2,
  Phone,
  Mail,
  Lock,
  Unlock,
  AlertCircle,
  Power,
  Settings,
  Briefcase
} from 'lucide-react';

// --- Configurações Fixas ---
const BARBER_FIXO = {
  id: 1,
  name: 'Adilson Oliveira',
  role: 'Barbeiro Especialista',
  email: 'ago.amojesus@gmail.com',
  phone: '(61) 9 9376-1331',
  rating: 5.0,
  avatar: 'AO'
};

const BUFFER_MINUTES = 10;

const DIAS_SEMANA = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"
];

// --- Helper Functions ---
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const minutesToTime = (totalMinutes) => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const isToday = (dateStr) => {
  const today = new Date().toISOString().split('T')[0];
  return dateStr === today;
};

const getDayOfWeek = (dateStr) => {
  if (!dateStr) return -1;
  const date = new Date(dateStr + 'T00:00:00');
  return date.getDay();
};

// --- Componentes de UI ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, type = "button" }) => {
  const variants = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800 border border-transparent',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 border border-transparent',
    outline: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
    danger: 'bg-red-500 text-white hover:bg-red-600 border border-transparent',
    success: 'bg-green-600 text-white hover:bg-green-700 border border-transparent',
    accent: 'bg-amber-500 text-white hover:bg-amber-600 border border-transparent shadow-lg shadow-amber-500/20'
  };
  
  return (
    <button 
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
    {children}
  </div>
);

// --- Aplicação Principal ---

export default function App() {
  const [currentView, setCurrentView] = useState('home');
  const [adminTab, setAdminTab] = useState('dashboard');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  
  // Estado de funcionamento manual (Aberto/Fechado apenas para hoje)
  const [isManuallyClosedToday, setIsManuallyClosedToday] = useState(false);

  // Identificador do usuário atual para filtrar agendamentos
  const [sessionUserPhone, setSessionUserPhone] = useState(localStorage.getItem('userPhone') || '');

  // Agendamentos
  const [appointments, setAppointments] = useState([]);
  
  const [workingHours, setWorkingHours] = useState([]);

  const [services, setServices] = useState([]);

  useEffect(() => {
  fetchInitialData();
}, []);

const fetchInitialData = async () => {
  try {
    // Busca Serviços
    const { data: svc, error: errSvc } = await supabase
      .from('services')
      .select('*')
      .order('name');
    if (svc) setServices(svc);

    // Busca Configurações (Horários)
    const { data: set, error: errSet } = await supabase
      .from('settings')
      .select('*');
    
    if (set) {
      const hours = set.find(s => s.key === 'working_hours')?.value;
      if (hours) setWorkingHours(hours);
    }

    // Busca Agendamentos
    const { data: appt, error: errAppt } = await supabase
      .from('appointments')
      .select('*');
    if (appt) setAppointments(appt);

  } catch (error) {
    console.error("Erro ao carregar dados:", error);
  }
};

  const [bookingStep, setBookingStep] = useState(1);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [clientData, setClientData] = useState({ name: '', phone: '' });
  const [editingService, setEditingService] = useState(null);

  // --- Lógicas de Suporte ---

  const resetBooking = () => {
    setBookingStep(1);
    setSelectedService(null);
    setSelectedDate('');
    setSelectedTime('');
    setClientData({ name: '', phone: sessionUserPhone });
    setCurrentView('home');
  };

  const handleUpdateWorkingHours = (day, field, value) => {
    setWorkingHours(prev => prev.map(h => h.day === day ? { ...h, [field]: value } : h));
  };

  // --- Lógica de Horários ---
  const getAvailableSlots = (date, service) => {
    if (!date || !service) return [];

    // Se for hoje e estiver marcado como fechado manualmente, não tem horários
    if (isToday(date) && isManuallyClosedToday) return [];

    const dayIndex = getDayOfWeek(date);
    const dayConfig = workingHours.find(h => h.day === dayIndex);
    
    if (!dayConfig || dayConfig.closed) return [];

    const slots = [];
    const startMins = timeToMinutes(dayConfig.open);
    const endMins = timeToMinutes(dayConfig.close);
    const serviceDuration = service.duration || 0;
    
    const dayAppointments = appointments
      .filter(app => app.date === date && app.status !== 'Cancelado')
      .map(app => ({
        start: timeToMinutes(app.time),
        end: timeToMinutes(app.time) + (app.service?.duration || 0) + BUFFER_MINUTES
      }));

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    let currentPointer = startMins;

    while (currentPointer + serviceDuration <= endMins) {
      if (isToday(date) && currentPointer < currentMins + 30) {
        currentPointer += 30;
        continue;
      }

      const hasConflict = dayAppointments.some(app => {
        return (currentPointer < app.end && (currentPointer + serviceDuration + BUFFER_MINUTES) > app.start);
      });

      if (!hasConflict) {
        slots.push(minutesToTime(currentPointer));
        currentPointer += 30; 
      } else {
        const conflictingApp = dayAppointments.find(app => currentPointer < app.end && (currentPointer + serviceDuration + BUFFER_MINUTES) > app.start);
        currentPointer = conflictingApp ? conflictingApp.end : currentPointer + 30; 
      }
    }
    return slots;
  };

  const availableSlots = useMemo(() => getAvailableSlots(selectedDate, selectedService), [selectedDate, selectedService, appointments, workingHours, isManuallyClosedToday]);

  // Estatísticas para o Dashboard
  const stats = useMemo(() => {
    const hoje = new Date().toISOString().split('T')[0];
    const appsHoje = appointments.filter(a => a.date === hoje);
    return {
      total: appsHoje.length,
      confirmados: appsHoje.filter(a => a.status === 'Confirmado').length,
      pendentes: appsHoje.filter(a => a.status === 'Pendente').length
    };
  }, [appointments]);

const handleBooking = async () => {
  // Objeto preparado para o Postgres (snake_case)
  const novoAgendamento = {
    client_name: clientData.name,
    client_phone: clientData.phone,
    date: selectedDate,
    time: selectedTime,
    service_name: selectedService.name,
    service_duration: selectedService.duration,
    service_price: selectedService.price,
    status: 'Pendente'
  };

  const { data, error } = await supabase
    .from('appointments')
    .insert([novoAgendamento])
    .select();

  if (error) {
    alert("Erro ao gravar no banco: " + error.message);
    return;
  }

  // Se gravou com sucesso, atualizamos o estado local
  setAppointments([...appointments, data[0]]);
  setSessionUserPhone(clientData.phone);
  setBookingStep(5);
};

const handleAdminLogin = async (e) => {
  e.preventDefault();

  // Busca no banco se existe a chave admin_password com o valor digitado
  const { data, error } = await supabase
    .from('system_auth')
    .select('value')
    .eq('key', 'admin_password')
    .single(); // .single() porque esperamos apenas uma linha

  if (error) {
    console.error("Erro ao validar senha:", error);
    alert('Erro ao conectar ao servidor.');
    return;
  }

  if (data && data.value === adminPassword) {
    setIsAdminAuthenticated(true);
    setCurrentView('admin');
    setAdminTab('dashboard');
    setAdminPassword(''); // Limpa o campo por segurança
  } else {
    alert('Senha incorreta!');
  }
};

const updateStatus = async (id, newStatus) => {
  const { error } = await supabase
    .from('appointments')
    .update({ status: newStatus })
    .eq('id', id);

  if (error) {
    alert("Erro ao atualizar status: " + error.message);
  } else {
    // Atualiza o front apenas se o banco confirmou
    setAppointments(appointments.map(a => a.id === id ? { ...a, status: newStatus } : a));
  }
};

const handleUpdateService = async (e) => {
  e.preventDefault();
  if (!editingService) return;

  const { error } = await supabase
    .from('services')
    .update({
      name: editingService.name,
      duration: parseInt(editingService.duration),
      price: parseFloat(editingService.price)
    })
    .eq('id', editingService.id);

  if (error) {
    alert("Erro ao salvar no banco: " + error.message);
  } else {
    setServices(services.map(s => s.id === editingService.id ? editingService : s));
    setEditingService(null);
  }
};

const deleteService = async (id) => {
  if(confirm('Tem certeza que deseja apagar este serviço?')) {
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id);

    if (error) {
      alert("Erro ao deletar: " + error.message);
    } else {
      setServices(services.filter(s => s.id !== id));
    }
  }
};

const addService = async () => {
  const newS = { 
    name: 'Novo Serviço', 
    duration: 30, 
    price: 0 
  };

  const { data, error } = await supabase
    .from('services')
    .insert([newS])
    .select();

  if (error) {
    alert("Erro ao criar serviço: " + error.message);
  } else {
    // data[0] contém o serviço com o ID gerado pelo Postgres
    setServices([...services, data[0]]);
    setEditingService(data[0]);
    setIsAddingService(true); // Se você usa essa flag para abrir o modal/form
  }
};

  // Filtrar apenas agendamentos do usuário atual
  const myAppointments = useMemo(() => {
    if (!sessionUserPhone) return [];
    return appointments.filter(app => app.clientPhone === sessionUserPhone);
  }, [appointments, sessionUserPhone]);

  const NavItem = ({ view, icon: Icon, label }) => (
    <button 
      onClick={() => { 
        if (view === 'admin' && !isAdminAuthenticated) {
          setCurrentView('admin-login');
        } else {
          setCurrentView(view); 
        }
      }}
      className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${currentView === view ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentView('home')}>
            <div className="bg-slate-900 text-white p-2 rounded-lg">
              <Scissors size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Barbearia Dilsin</h1>
          </div>
          <nav className="hidden md:flex items-center gap-2">
            <NavItem view="home" icon={Home} label="Início" />
            <NavItem view="my-appointments" icon={ClipboardList} label="Agendamentos" />
            <NavItem view="admin" icon={LayoutDashboard} label="Painel ADM" />
            <Button onClick={() => { setCurrentView('booking'); setBookingStep(1); }} className="ml-4">Agendar Agora</Button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {/* --- VIEW: ADMIN LOGIN --- */}
        {currentView === 'admin-login' && (
          <div className="max-w-md mx-auto py-12">
            <Card className="p-8">
              <div className="text-center mb-8">
                <Lock className="text-slate-900 mx-auto mb-4" size={32} />
                <h2 className="text-2xl font-bold">Acesso Restrito</h2>
              </div>
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <input 
                  type="password" 
                  autoFocus
                  className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="Senha Administrativa"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
                <Button type="submit" className="w-full">Entrar</Button>
                <button onClick={() => setCurrentView('home')} className="w-full text-sm text-slate-400">Voltar</button>
              </form>
            </Card>
          </div>
        )}

        {/* --- VIEW: HOME --- */}
        {currentView === 'home' && (
          <div className="space-y-12">
            <section 
              className="relative rounded-3xl bg-slate-900 text-white p-8 md:p-16 overflow-hidden min-h-[500px] flex items-center"
              style={{
                backgroundImage: 'url("https://images.unsplash.com/photo-1772648859884-c7ae152bf10d?q=80&w=959&auto=format&fit=crop")',
                backgroundSize: 'cover', backgroundPosition: 'center'
              }}
            >
              <div className="absolute inset-0 bg-black/60 z-0"></div>
              <div className="relative z-10 max-w-2xl">
                {/* Indicador de Status Aberto/Fechado (Somente para hoje) */}
                <div className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
                  <div className={`w-2 h-2 rounded-full ${isManuallyClosedToday ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    {isManuallyClosedToday ? 'Fechado Hoje (Aceitando agendamentos futuros)' : 'Aberto para Agendamentos'}
                  </span>
                </div>
                
                <h2 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">O visual impecável que você merece.</h2>
                <p className="text-slate-200 text-lg mb-8">Tradição com Adilson Oliveira. Agende seu horário com quem entende de verdade.</p>
                
                <Button onClick={() => setCurrentView('booking')} variant="accent" className="px-10 py-4 text-lg font-bold">AGENDAR AGORA</Button>
              </div>
            </section>

            <section>
              <h3 className="text-2xl font-bold mb-6">Nossos Serviços</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {services.map(service => (
                  <Card key={service.id} className="p-6">
                    <h4 className="font-bold text-lg">{service.name}</h4>
                    <p className="text-slate-500 text-sm mb-4">{service.duration} minutos</p>
                    <span className="text-xl font-bold">R$ {service.price?.toFixed(2)}</span>
                  </Card>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* --- VIEW: BOOKING --- */}
        {currentView === 'booking' && (
          <div className="max-w-3xl mx-auto">
              <>
                <div className="mb-8 flex items-center justify-between">
                  <h2 className="text-3xl font-bold">Novo Agendamento</h2>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map(step => (
                      <div key={step} className={`h-2 w-12 rounded-full ${bookingStep >= step ? 'bg-slate-900' : 'bg-slate-200'}`} />
                    ))}
                  </div>
                </div>

                {bookingStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold mb-4">Escolha o serviço</h3>
                    {services.map(s => (
                      <div key={s.id} onClick={() => { setSelectedService(s); setBookingStep(2); }} className="flex justify-between p-4 rounded-xl border-2 cursor-pointer hover:border-slate-900">
                        <div><p className="font-bold">{s.name}</p><p className="text-sm text-slate-500">{s.duration} min</p></div>
                        <p className="font-bold">R$ {s.price?.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {bookingStep === 2 && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <label className="block text-sm font-medium">Data</label>
                        <input type="date" min={new Date().toISOString().split('T')[0]} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-slate-900" />
                        
                        {isToday(selectedDate) && isManuallyClosedToday && (
                          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex items-start gap-2">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            <span>Hoje a barbearia não está aceitando novos horários. Selecione outra data livre!</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <label className="block text-sm font-medium">Horário</label>
                        {availableSlots.length > 0 ? (
                          <div className="grid grid-cols-3 gap-2">
                            {availableSlots.map(t => (
                              <button key={t} onClick={() => setSelectedTime(t)} className={`p-2 text-sm rounded-lg border ${selectedTime === t ? 'bg-slate-900 text-white' : 'bg-white hover:border-slate-400'}`}>{t}</button>
                            ))}
                          </div>
                        ) : (
                          <div className="text-slate-400 text-center py-8 italic border rounded-lg border-dashed">
                            {selectedDate ? "Sem horários livres para este dia." : "Selecione uma data acima."}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between pt-6 border-t">
                      <Button variant="outline" onClick={() => setBookingStep(1)}>Voltar</Button>
                      <Button disabled={!selectedDate || !selectedTime} onClick={() => setBookingStep(3)}>Continuar</Button>
                    </div>
                  </div>
                )}

                {bookingStep === 3 && (
                  <div className="max-w-md mx-auto space-y-4">
                    <h3 className="text-xl font-semibold text-center">Seus Dados</h3>
                    <input type="text" placeholder="Seu Nome" className="w-full p-3 border rounded-lg" value={clientData.name} onChange={(e) => setClientData({...clientData, name: e.target.value})} />
                    <input type="tel" placeholder="Telefone (WhatsApp)" className="w-full p-3 border rounded-lg" value={clientData.phone} onChange={(e) => setClientData({...clientData, phone: e.target.value})} />
                    <div className="flex justify-between pt-6">
                      <Button variant="outline" onClick={() => setBookingStep(2)}>Voltar</Button>
                      <Button disabled={!clientData.name || !clientData.phone} onClick={() => setBookingStep(4)}>Revisar</Button>
                    </div>
                  </div>
                )}

                {bookingStep === 4 && (
                  <Card className="p-8 space-y-6">
                    <h3 className="text-2xl font-bold text-center">Confirmar Agendamento</h3>
                    
                    <div className="space-y-4">
                      {/* Dados do Cliente */}
                      <div className="bg-slate-50 p-4 rounded-lg space-y-2 border border-slate-100">
                        <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-2">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Seus Dados</span>
                          <button onClick={() => setBookingStep(3)} className="text-xs text-amber-600 font-bold hover:underline flex items-center gap-1">
                            <Edit2 size={12}/> Alterar
                          </button>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Nome:</span>
                          <span className="font-bold">{clientData.name}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Telefone:</span>
                          <span className="font-bold">{clientData.phone}</span>
                        </div>
                      </div>

                      {/* Detalhes do Serviço */}
                      <div className="bg-slate-50 p-4 rounded-lg space-y-2 border border-slate-100">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-200 pb-2 mb-2">Detalhes</span>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Serviço:</span>
                          <span className="font-bold">{selectedService?.name}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Data:</span>
                          <span className="font-bold">{selectedDate.split('-').reverse().join('/')}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Horário:</span>
                          <span className="font-bold">{selectedTime}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-2 mt-2 text-base">
                          <span className="font-bold">Total:</span>
                          <span className="font-bold text-slate-900">R$ {selectedService?.price?.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Button onClick={handleBooking} className="w-full py-4 font-bold text-lg">FINALIZAR AGENDAMENTO</Button>
                      <button onClick={() => setBookingStep(2)} className="w-full text-sm text-slate-400 hover:text-slate-900 transition-colors">Voltar para escolha de data</button>
                    </div>
                  </Card>
                )}

                {bookingStep === 5 && (
                  <div className="text-center py-12">
                    <CheckCircle2 size={64} className="mx-auto text-green-500 mb-4" />
                    <h2 className="text-3xl font-bold mb-2">Enviado!</h2>
                    <p className="text-slate-500 mb-8">Aguarde a confirmação do Adilson.</p>
                    <Button onClick={resetBooking}>Voltar para o Início</Button>
                  </div>
                )}
              </>
          </div>
        )}

        {/* --- VIEW: MY APPOINTMENTS --- */}
        {currentView === 'my-appointments' && (
          <div>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold">Seus Agendamentos</h2>
              {sessionUserPhone && (
                <span className="text-xs text-slate-400">Identificado pelo telefone: {sessionUserPhone}</span>
              )}
            </div>
            
            {!sessionUserPhone ? (
               <Card className="p-12 text-center space-y-4 border-dashed border-2">
                 <User className="mx-auto text-slate-300" size={48} />
                 <h3 className="text-xl font-bold">Identifique-se</h3>
                 <p className="text-slate-500">Para ver seus horários, você precisa realizar um agendamento ou digitar seu telefone cadastrado.</p>
                 <div className="flex gap-2 max-w-xs mx-auto">
                    <input 
                      type="tel" 
                      placeholder="Seu telefone" 
                      className="p-2 border rounded-lg w-full"
                      value={clientData.phone}
                      onChange={(e) => setClientData({...clientData, phone: e.target.value})}
                    />
                    <Button onClick={() => {
                      setSessionUserPhone(clientData.phone);
                      localStorage.setItem('userPhone', clientData.phone);
                    }}>Ok</Button>
                 </div>
               </Card>
            ) : myAppointments.length === 0 ? (
              <Card className="p-12 text-center border-dashed border-2 text-slate-400">
                Você ainda não realizou nenhum agendamento com este telefone.
                <div className="mt-4">
                  <Button variant="outline" onClick={() => { setSessionUserPhone(''); localStorage.removeItem('userPhone'); }}>Trocar Telefone</Button>
                </div>
              </Card>
            ) : (
              <div className="grid gap-4">
                {myAppointments.map(app => (
                  <Card key={app.id} className="p-6 flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-lg">{app.service?.name}</h4>
                      <p className="text-sm text-slate-500">{app.date.split('-').reverse().join('/')} às {app.time}</p>
                      <div className="mt-2">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${app.status === 'Confirmado' ? 'bg-green-100 text-green-700' : app.status === 'Pendente' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {app.status}
                        </span>
                      </div>
                    </div>
                    {/* O usuário não pode deletar/cancelar aqui por este botão, apenas ver o status */}
                    <div className="text-xs text-slate-400 italic">Para cancelar, contate Adilson</div>
                  </Card>
                ))}
                <div className="text-center mt-6">
                   <Button variant="outline" onClick={() => { setSessionUserPhone(''); localStorage.removeItem('userPhone'); }}>Sair desta conta</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- VIEW: ADMIN (COM ABAS) --- */}
        {currentView === 'admin' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h2 className="text-3xl font-bold">Painel de Gestão</h2>
              <div className="flex gap-2">
                <Button variant={adminTab === 'dashboard' ? 'primary' : 'outline'} onClick={() => setAdminTab('dashboard')} className="flex items-center gap-2"><LayoutDashboard size={18}/> Dashboard</Button>
                <Button variant={adminTab === 'services' ? 'primary' : 'outline'} onClick={() => setAdminTab('services')} className="flex items-center gap-2"><Briefcase size={18}/> Serviços</Button>
                <Button variant={adminTab === 'config' ? 'primary' : 'outline'} onClick={() => setAdminTab('config')} className="flex items-center gap-2"><Settings size={18}/> Configurações</Button>
                <Button variant="danger" onClick={() => setIsAdminAuthenticated(false)}><Unlock size={18}/></Button>
              </div>
            </div>

            {/* ABA: DASHBOARD */}
            {adminTab === 'dashboard' && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="p-6 bg-slate-900 text-white">
                    <p className="text-slate-400 text-sm">Agendamentos hoje</p>
                    <h3 className="text-3xl font-bold">{stats.total}</h3>
                  </Card>
                  <Card className="p-6 border-l-4 border-green-500">
                    <p className="text-slate-500 text-sm">Confirmados</p>
                    <h3 className="text-3xl font-bold">{stats.confirmados}</h3>
                  </Card>
                  <Card className="p-6 border-l-4 border-amber-500">
                    <p className="text-slate-500 text-sm">Pendentes</p>
                    <h3 className="text-3xl font-bold">{stats.pendentes}</h3>
                  </Card>
                </div>

                <Card className="overflow-hidden">
                   <div className="p-6 border-b border-slate-200">
                     <h3 className="text-xl font-bold">Agenda Completa (Todos os Clientes)</h3>
                   </div>
                   <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-6 py-4 text-sm font-semibold text-slate-500 uppercase">Horário</th>
                          <th className="px-6 py-4 text-sm font-semibold text-slate-500 uppercase">Cliente</th>
                          <th className="px-6 py-4 text-sm font-semibold text-slate-500 uppercase">Serviço</th>
                          <th className="px-6 py-4 text-sm font-semibold text-slate-500 uppercase">Status</th>
                          <th className="px-6 py-4 text-sm font-semibold text-slate-500 uppercase text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {appointments.sort((a,b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time)).map(a => (
                          <tr key={a.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4">
                              <span className="font-bold block">{a.time}</span>
                              <span className="text-xs text-slate-400">{a.date.split('-').reverse().join('/')}</span>
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-bold">{a.clientName}</p>
                              <p className="text-xs text-slate-500 flex items-center gap-1"><Phone size={10}/> {a.clientPhone}</p>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">{a.service?.name}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${a.status === 'Confirmado' ? 'bg-green-100 text-green-700' : a.status === 'Pendente' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                {a.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                              {a.status === 'Pendente' && (
                                <button onClick={() => updateStatus(a.id, 'Confirmado')} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Confirmar"><CheckCircle2 size={18}/></button>
                              )}
                              {a.status !== 'Cancelado' && (
                                <button onClick={() => updateStatus(a.id, 'Cancelado')} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Cancelar"><Trash2 size={18}/></button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                   </div>
                </Card>
              </div>
            )}

            {/* ABA: CONFIGURAÇÕES */}
            {adminTab === 'config' && (
              <div className="space-y-8 animate-in slide-in-from-left-4 duration-300">
                <Card className="p-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                    <div>
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <Power className={isManuallyClosedToday ? 'text-red-500' : 'text-green-500'} />
                        Status da Barbearia (HOJE)
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">Este botão desativa agendamentos para o dia de HOJE. Dias futuros continuam abertos.</p>
                    </div>
                    <button 
                      onClick={() => setIsManuallyClosedToday(!isManuallyClosedToday)}
                      className={`relative inline-flex h-12 w-28 items-center rounded-full transition-colors focus:outline-none shadow-inner ${isManuallyClosedToday ? 'bg-red-500' : 'bg-green-500'}`}
                    >
                      <span className={`inline-block h-8 w-8 transform rounded-full bg-white transition-transform shadow-md ${isManuallyClosedToday ? 'translate-x-16' : 'translate-x-2'}`} />
                      <span className={`absolute ${isManuallyClosedToday ? 'left-4' : 'right-4'} text-[10px] font-bold text-white uppercase`}>
                        {isManuallyClosedToday ? 'Fechado' : 'Aberto'}
                      </span>
                    </button>
                  </div>

                  <h3 className="text-xl font-bold mb-4">Horários Regulares</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {workingHours.map(wh => (
                      <div key={wh.day} className={`p-4 rounded-xl border flex items-center justify-between ${wh.closed ? 'bg-red-50/50 border-red-100' : 'bg-white border-slate-200'}`}>
                        <div>
                          <p className="font-bold text-sm">{DIAS_SEMANA[wh.day]}</p>
                          <label className="flex items-center gap-2 mt-1 cursor-pointer">
                            <input type="checkbox" checked={!wh.closed} onChange={(e) => handleUpdateWorkingHours(wh.day, 'closed', !e.target.checked)} className="accent-slate-900" />
                            <span className="text-xs">{wh.closed ? 'Não funcionamos' : 'Funcionamos'}</span>
                          </label>
                        </div>
                        {!wh.closed && (
                          <div className="flex gap-2">
                            <input type="time" className="p-1 border rounded text-xs" value={wh.open} onChange={e => handleUpdateWorkingHours(wh.day, 'open', e.target.value)} />
                            <span className="text-slate-400 text-xs">até</span>
                            <input type="time" className="p-1 border rounded text-xs" value={wh.close} onChange={e => handleUpdateWorkingHours(wh.day, 'close', e.target.value)} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* ABA: SERVIÇOS */}
            {adminTab === 'services' && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold">Gerenciar Serviços</h3>
                  <Button onClick={addService} variant="success" className="flex items-center gap-2"><Plus size={18}/> Novo Serviço</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {services.map(s => (
                    <Card key={s.id} className="p-6 hover:border-slate-400 transition-all group">
                      {editingService?.id === s.id ? (
                        <div className="space-y-4">
                           <input className="w-full p-2 border rounded" placeholder="Nome do serviço" value={editingService.name} onChange={e => setEditingService({...editingService, name: e.target.value})} />
                           <div className="grid grid-cols-2 gap-2">
                             <div>
                               <label className="text-[10px] text-slate-400 uppercase font-bold">Minutos</label>
                               <input className="w-full p-2 border rounded" type="number" value={editingService.duration} onChange={e => setEditingService({...editingService, duration: Number(e.target.value)})} />
                             </div>
                             <div>
                               <label className="text-[10px] text-slate-400 uppercase font-bold">Preço R$</label>
                               <input className="w-full p-2 border rounded" type="number" value={editingService.price} onChange={e => setEditingService({...editingService, price: Number(e.target.value)})} />
                             </div>
                           </div>
                           <div className="flex gap-2">
                             <Button onClick={handleUpdateService} className="flex-1 bg-green-600">Salvar</Button>
                             <Button onClick={() => setEditingService(null)} variant="outline">Cancelar</Button>
                           </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-lg font-bold">{s.name}</h4>
                            <div className="flex gap-4 text-xs text-slate-500 mt-1">
                              <span className="flex items-center gap-1"><Clock size={12}/> {s.duration} min</span>
                              <span className="flex items-center gap-1 font-bold text-slate-900">R$ {s.price?.toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setEditingService(s)} className="p-2 text-slate-400 hover:text-slate-900"><Edit2 size={16}/></button>
                            <button onClick={() => deleteService(s.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      <footer className="bg-white border-t border-slate-200 py-12 mt-12">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h2 className="text-lg font-bold">Barbearia Dilsin</h2>
            <p className="text-slate-500 text-sm italic">{BARBER_FIXO.name} • {BARBER_FIXO.phone}</p>
          </div>
          <div className="text-slate-400 text-sm">© 2026 • Sistema Administrativo</div>
        </div>
      </footer>
    </div>
  );
}