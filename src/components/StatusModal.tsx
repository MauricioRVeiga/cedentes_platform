import React from 'react';
import './StatusModal.css';

interface StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStatus: (status: string) => void;
}

const StatusModal: React.FC<StatusModalProps> = ({ isOpen, onClose, onSelectStatus }) => {
  if (!isOpen) return null;

  const statusOptions = [
    { label: 'CONTRATO ASSINADO MANUALMENTE', color: '#d4edda' },
    { label: 'CONTRATO SEM ASSINATURA FÍSICA/DIGITAL', color: '#f8d7da' },
    { label: 'CONTRATO PRECISA SER RENOVADO', color: '#f8d7da' },
    { label: 'CONTRATOS IMPRESSOS QUE FALTAM ASSINAR', color: '#fff3cd' },
    { label: 'CEDENTES QUE JÁ FORAM AVISADOS DA RENOVAÇÃO', color: '#cff4fc' },
    { label: 'LEVOU O CONTRATO PARA ASSINAR', color: '#87ceeb' }
  ];

  return (
    <div className="status-modal-overlay">
      <div className="status-modal">
        <div className="status-modal-header">
          <h3>Selecione o Status</h3>
          <button onClick={onClose}>&times;</button>
        </div>
        <div className="status-modal-content">
          {statusOptions.map((status, index) => (
            <div
              key={index}
              className="status-option"
              style={{ backgroundColor: status.color }}
              onClick={() => {
                onSelectStatus(status.label);
                onClose();
              }}
            >
              {status.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StatusModal;
