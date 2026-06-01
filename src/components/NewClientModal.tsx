import { useEffect, useRef, useState } from 'react';
import { useUI } from '@/store/ui';
import { useData, updateClientProfile } from '@/store/data';
import { clientKey } from '@/services/clients';
import { toast } from '@/services/toast';

export function NewClientModal() {
  const open = useUI(s => s.newClientModalOpen);
  const close = useUI(s => s.closeNewClientModal);
  const openClientDetail = useUI(s => s.openClientDetail);
  const data = useData(s => s.data);

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');
  const [nameErr, setNameErr] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setDisplayName('');
    setPhone('');
    setEmail('');
    setWhatsapp('');
    setHourlyRate('');
    setTags('');
    setNotes('');
    setNameErr(false);
    setTimeout(() => nameRef.current?.focus(), 60);
  }, [open]);

  if (!open) return null;

  const save = () => {
    const t = displayName.trim();
    if (!t) {
      setNameErr(true);
      setTimeout(() => setNameErr(false), 1000);
      toast.error('Coloca o nome do cliente');
      return;
    }
    const key = clientKey(t);
    // Check if client with same key already exists
    if (data.clientProfiles?.[key]) {
      toast.error(`Cliente "${t}" já existe. Edite o perfil dele em vez de criar de novo.`);
      close();
      setTimeout(() => openClientDetail(key), 150);
      return;
    }
    updateClientProfile(t, {
      displayName: t,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      social: {
        whatsapp: whatsapp.trim() || undefined
      },
      tags: tags.split(',').map(s => s.trim()).filter(Boolean),
      hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
      notes: notes.trim() || undefined
    });
    toast.success(`Cliente "${t}" criado`, { icon: '👤' });
    close();
    setTimeout(() => openClientDetail(key), 150);
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <h2>👤 Novo cliente</h2>
        <p style={{ fontSize: 11, color: 'var(--text3)', margin: '-6px 0 12px' }}>
          Cadastra o perfil completo do cliente. Cards futuros com o nome dele linkam automático.
        </p>

        <div className="frow">
          <label className="flabel">Nome do cliente *</label>
          <input
            ref={nameRef}
            className="finput"
            placeholder="Ex: Loja da Maria"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={nameErr ? { borderColor: 'var(--red)' } : undefined}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="frow">
            <label className="flabel">Email</label>
            <input
              className="finput"
              type="email"
              placeholder="cliente@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="frow">
            <label className="flabel">Telefone</label>
            <input
              className="finput"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="frow">
            <label className="flabel">WhatsApp</label>
            <input
              className="finput"
              placeholder="número ou wa.me/…"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
          </div>
          <div className="frow">
            <label className="flabel">Valor/hora (R$)</label>
            <input
              className="finput"
              type="number"
              placeholder="200"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
            />
          </div>
        </div>

        <div className="frow">
          <label className="flabel">Tags (separadas por vírgula)</label>
          <input
            className="finput"
            placeholder="vip, recorrente, magazord"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>

        <div className="frow">
          <label className="flabel">Notas (opcional)</label>
          <textarea
            className="finput"
            rows={3}
            placeholder="Contexto importante sobre o cliente…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="mfoot">
          <button className="btn btn-ghost" onClick={close}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Criar cliente</button>
        </div>
      </div>
    </div>
  );
}
