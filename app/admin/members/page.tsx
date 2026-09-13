'use client';

import React, { useEffect, useState } from 'react';
import { useTelegramAuth } from '@/components/TelegramAuthProvider';
import { Admin, AdminRequest } from '@/types/database';
import { Users, UserPlus, CheckCircle, XCircle, Shield, UserX, Clock } from 'lucide-react';

export default function AdminMembersPage() {
  const { role, initData, telegramUserId, isAuthenticated } = useTelegramAuth();
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [members, setMembers] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'REQUESTS' | 'MEMBERS'>('REQUESTS');

  const getAuthHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (initData) headers['x-telegram-init-data'] = initData;
    if (telegramUserId) headers['x-telegram-user-id'] = telegramUserId.toString();
    return headers;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [reqRes, memRes] = await Promise.all([
        fetch('/api/admin/requests', { headers }),
        fetch('/api/admin/members', { headers })
      ]);

      const reqJson = await reqRes.json();
      const memJson = await memRes.json();

      if (reqRes.ok && reqJson.success) setRequests(reqJson.requests || []);
      if (memRes.ok && memJson.success) setMembers(memJson.admins || []);
    } catch (err) {
      console.error('Failed to fetch admin management data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if ((isAuthenticated || initData || telegramUserId) && role === 'SUPER_ADMIN') {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [initData, telegramUserId, isAuthenticated, role]);

  const handleApprove = async (id: string) => {
    if (!confirm('이 관리자 신청을 승인하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/admin/requests/${id}/approve`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (res.ok && json.success) {
        alert(json.message);
        fetchData();
      } else {
        alert(json.error || '승인 처리 실패');
      }
    } catch (err: any) {
      alert(err.message || '네트워크 오류');
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm('이 관리자 신청을 거절하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/admin/requests/${id}/reject`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (res.ok && json.success) {
        alert(json.message);
        fetchData();
      } else {
        alert(json.error || '거절 처리 실패');
      }
    } catch (err: any) {
      alert(err.message || '네트워크 오류');
    }
  };

  const handleRoleChange = async (id: string, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/members/${id}/role`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ role: newRole })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        fetchData();
      } else {
        alert(json.error || '역할 변경 실패');
      }
    } catch (err: any) {
      alert(err.message || '네트워크 오류');
    }
  };

  const handleDeactivate = async (id: string, name: string) => {
    if (!confirm(`${name} 관리자를 비활성화(INACTIVE) 처리하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/admin/members/${id}/deactivate`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (res.ok && json.success) {
        alert(json.message);
        fetchData();
      } else {
        alert(json.error || '비활성화 처리 실패');
      }
    } catch (err: any) {
      alert(err.message || '네트워크 오류');
    }
  };

  if (role !== 'SUPER_ADMIN') {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <Shield className="w-12 h-12 text-rose-500 mx-auto mb-2" />
        <h2 className="text-lg font-bold text-slate-800">접근 제한 영역</h2>
        <p className="text-sm text-slate-500">관리자 신청 및 멤버 관리는 SUPER_ADMIN만 가능합니다.</p>
      </div>
    );
  }

  const pendingRequests = requests.filter(r => r.status === 'PENDING');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">관리자 승인 및 멤버 관리</h1>
          <p className="text-sm text-slate-500">신청된 관리자를 승인/거절하고 기존 관리자 역할을 변경하거나 비활성화합니다.</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl space-x-1">
          <button
            onClick={() => setActiveTab('REQUESTS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'REQUESTS' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>신청 대기 ({pendingRequests.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('MEMBERS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'MEMBERS' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>관리자 목록 ({members.length})</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'REQUESTS' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-3 flex items-center space-x-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <span>관리자 신청 내역</span>
          </h2>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">로딩 중...</div>
          ) : requests.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {requests.map((req) => (
                <div key={req.id} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          req.status === 'PENDING'
                            ? 'bg-amber-100 text-amber-800'
                            : req.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {req.status}
                      </span>
                      <h3 className="font-bold text-slate-900 text-base">{req.telegram_first_name}</h3>
                      {req.telegram_username && <span className="text-xs text-slate-500">(@{req.telegram_username})</span>}
                    </div>

                    <p className="text-xs text-slate-600">
                      Telegram User ID: <code className="bg-slate-100 px-1.5 py-0.5 rounded">{req.telegram_user_id}</code> | 요청 역할: <span className="font-semibold text-blue-600">{req.requested_role}</span>
                    </p>

                    <p className="text-[11px] text-slate-400">신청일: {new Date(req.created_at).toLocaleString('ko-KR')}</p>
                  </div>

                  {req.status === 'PENDING' && (
                    <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0">
                      <button
                        onClick={() => handleApprove(req.id)}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>승인</span>
                      </button>

                      <button
                        onClick={() => handleReject(req.id)}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>거절</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-sm">신청된 내역이 없습니다.</div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-3 flex items-center space-x-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <span>등록된 관리자 목록</span>
          </h2>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">로딩 중...</div>
          ) : members.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {members.map((mem) => (
                <div key={mem.id} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          mem.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {mem.status}
                      </span>
                      <h3 className="font-bold text-slate-900 text-base">{mem.telegram_first_name || '관리자'}</h3>
                      {mem.telegram_username && <span className="text-xs text-slate-500">(@{mem.telegram_username})</span>}
                    </div>

                    <p className="text-xs text-slate-600">
                      Telegram ID: <code className="bg-slate-100 px-1.5 py-0.5 rounded">{mem.telegram_user_id}</code>
                    </p>
                  </div>

                  <div className="flex items-center space-x-3 self-end sm:self-auto shrink-0">
                    {mem.role !== 'SUPER_ADMIN' ? (
                      <>
                        <select
                          value={mem.role}
                          onChange={(e) => handleRoleChange(mem.id, e.target.value)}
                          className="bg-slate-100 border border-slate-300 text-slate-800 rounded-lg text-xs font-semibold px-2.5 py-1.5"
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="VIEWER">VIEWER</option>
                        </select>

                        {mem.status === 'ACTIVE' && (
                          <button
                            onClick={() => handleDeactivate(mem.id, mem.telegram_first_name || '관리자')}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-semibold transition"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>비활성화</span>
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-xs font-extrabold bg-purple-100 text-purple-800 px-3 py-1 rounded-full">
                        SUPER_ADMIN
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-sm">등록된 관리자가 없습니다.</div>
          )}
        </div>
      )}
    </div>
  );
}
