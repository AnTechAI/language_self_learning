/**
 * AccountModal.tsx — Đăng nhập / tài khoản + đồng bộ (GĐ 5).
 * Mở từ nút ⚙️ trên header. Không đăng nhập → form email/mật khẩu;
 * đã đăng nhập → thông tin tài khoản + nút "Đồng bộ ngay" / "Đăng xuất".
 */
import { useState } from 'react';
import { Button } from '../../components/ui';
import { useCourseStore } from '../../store/useCourseStore';

const STATUS_LABEL: Record<string, string> = {
  off: 'Chưa đăng nhập — dữ liệu chỉ lưu trên máy này',
  idle: 'Đã đăng nhập',
  syncing: 'Đang đồng bộ…',
  synced: 'Đã đồng bộ',
  error: 'Lỗi đồng bộ',
};

export function AccountModal({ onClose }: { onClose: () => void }) {
  const account = useCourseStore((s) => s.account);
  const syncStatus = useCourseStore((s) => s.syncStatus);
  const syncError = useCourseStore((s) => s.syncError);
  const lastSyncAt = useCourseStore((s) => s.lastSyncAt);
  const login = useCourseStore((s) => s.login);
  const register = useCourseStore((s) => s.register);
  const logout = useCourseStore((s) => s.logout);
  const syncNow = useCourseStore((s) => s.syncNow);
  const showToast = useCourseStore((s) => s.showToast);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (mode: 'login' | 'register') => {
    if (busy) return;
    if (!email.includes('@') || password.length < 6) {
      setFormError('Email không hợp lệ hoặc mật khẩu dưới 6 ký tự');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await (mode === 'login' ? login(email, password) : register(email, password));
      showToast(mode === 'login' ? '👋 Đăng nhập thành công' : '🎉 Đã tạo tài khoản');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setBusy(false);
    }
  };

  const lastSync = lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString('vi-VN') : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal account-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>👤 Tài khoản &amp; đồng bộ</h3>
          <button className="modal-x" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </div>

        {!account ? (
          <div className="account-form">
            <p className="help">
              Tạo tài khoản để đồng bộ từ vựng + tiến độ lên máy chủ — dùng trên nhiều thiết bị,
              không mất khi đổi máy. <b>Chưa có tài khoản: cứ đăng ký</b>.
            </p>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ban@email.com"
                autoFocus
              />
            </label>
            <label>
              Mật khẩu (≥ 6 ký tự)
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submit('login');
                }}
              />
            </label>
            {formError ? <p className="error">{formError}</p> : null}
            <div className="account-actions">
              <Button variant="primary" disabled={busy} onClick={() => void submit('register')}>
                {busy ? 'Đang xử lý…' : 'Đăng ký'}
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => void submit('login')}>
                Đăng nhập
              </Button>
            </div>
          </div>
        ) : (
          <div className="account-info">
            <p>
              <b>{account.email}</b>
            </p>
            <p className="help">Thiết bị: {account.deviceId}</p>
            <p className={`sync-status sync-${syncStatus}`}>
              {STATUS_LABEL[syncStatus] || syncStatus}
              {syncStatus === 'error' && syncError ? ` — ${syncError}` : ''}
              {lastSync ? ` (lần cuối ${lastSync})` : ''}
            </p>
            <div className="account-actions">
              <Button
                variant="primary"
                disabled={syncStatus === 'syncing'}
                onClick={() => void syncNow()}
              >
                {syncStatus === 'syncing' ? 'Đang đồng bộ…' : '🔄 Đồng bộ ngay'}
              </Button>
              <Button variant="ghost" onClick={() => void logout()}>
                Đăng xuất
              </Button>
            </div>
          </div>
        )}

        <p className="help" style={{ marginTop: 12 }}>
          💡 Dữ liệu vẫn lưu offline ở máy; đồng bộ chỉ chạy khi bạn bấm hoặc sau khi học (tự push,
          2 giây sau mỗi thay đổi). Mật khẩu không lưu trên máy.
        </p>
      </div>
    </div>
  );
}
