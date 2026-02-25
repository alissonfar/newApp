import React, { useState, useEffect } from 'react';
import { backupApi } from '../../services/api';
import { toast } from 'react-toastify';
import { FaSpinner, FaDatabase, FaDownload } from 'react-icons/fa';
import './BackupManagement.css';

function BackupManagement() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  useEffect(() => {
    carregarBackups(page);
  }, [page]);

  const carregarBackups = async (p) => {
    setLoading(true);
    try {
      const data = await backupApi.listar(p, limit);
      setBackups(data.backups || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Erro ao carregar backups:', error);
      toast.error(error?.erro || 'Erro ao carregar lista de backups.');
    } finally {
      setLoading(false);
    }
  };

  const handleGerarBackup = async () => {
    setGenerating(true);
    try {
      const result = await backupApi.gerar();
      toast.success(`Backup gerado: ${result.file} (${result.size})`);
      carregarBackups(page);
    } catch (error) {
      console.error('Erro ao gerar backup:', error);
      toast.error(error?.erro || 'Erro ao gerar backup.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (filename) => {
    setDownloading(filename);
    try {
      const response = await backupApi.download(filename);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Download iniciado.');
    } catch (error) {
      console.error('Erro ao baixar backup:', error);
      toast.error(error?.response?.data?.erro || 'Erro ao baixar arquivo.');
    } finally {
      setDownloading(null);
    }
  };

  const formatarTamanho = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatarData = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('pt-BR');
  };

  const totalPaginas = Math.ceil(total / limit) || 1;

  return (
    <section className="backup-management-section">
      <h2>Backup do Banco de Dados</h2>
      <p className="backup-description">
        Gere um backup completo do MongoDB e baixe o arquivo para armazenamento seguro.
        Use em caso de corrupção, exclusão acidental ou migração de servidor.
      </p>

      <div className="backup-actions">
        <button
          className="btn-gerar-backup"
          onClick={handleGerarBackup}
          disabled={generating}
          title="Gerar novo backup"
        >
          {generating ? (
            <>
              <FaSpinner className="spinner" /> Gerando backup...
            </>
          ) : (
            <>
              <FaDatabase /> Gerar Backup
            </>
          )}
        </button>
      </div>

      <div className="backups-list-container">
        <h3>Backups disponíveis</h3>
        {loading ? (
          <div className="backup-loading">
            <FaSpinner className="spinner" /> Carregando...
          </div>
        ) : backups.length === 0 ? (
          <p className="backup-empty">Nenhum backup gerado ainda.</p>
        ) : (
          <>
            <table className="backups-table">
              <thead>
                <tr>
                  <th>Arquivo</th>
                  <th>Tipo</th>
                  <th>Tamanho</th>
                  <th>Data</th>
                  <th>Criado por</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b._id}>
                    <td className="filename-cell">{b.filename}</td>
                    <td><span className={`type-badge type-${b.type}`}>{b.type}</span></td>
                    <td>{formatarTamanho(b.size)}</td>
                    <td>{formatarData(b.createdAt)}</td>
                    <td>{b.createdBy?.nome || b.createdBy?.email || '-'}</td>
                    <td>
                      <button
                        className="btn-download"
                        onClick={() => handleDownload(b.filename)}
                        disabled={downloading === b.filename}
                        title="Baixar backup"
                      >
                        {downloading === b.filename ? (
                          <FaSpinner className="spinner-small" />
                        ) : (
                          <FaDownload />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPaginas > 1 && (
              <div className="backup-pagination">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Anterior
                </button>
                <span>Página {page} de {totalPaginas}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))}
                  disabled={page === totalPaginas}
                >
                  Próxima
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default BackupManagement;
