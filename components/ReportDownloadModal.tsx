'use client';

import React, { useState, useRef } from 'react';
import { toPng } from 'html-to-image';
import {
  X,
  Download,
  Printer,
  CheckSquare,
  Square,
  Sparkles,
  Award,
  MessageSquare,
  BarChart3,
  Calendar,
  Users,
  CheckCircle2
} from 'lucide-react';
import { formatKstDateTime } from '@/lib/dateUtils';

interface QuestionAnalyticsItem {
  question_id: string;
  title: string;
  type: string;
  answered_count: number;
  option_breakdown?: Array<{ option: string; count: number; percentage: number }>;
  other_answers?: Array<{ user_name: string; text: string; submitted_at: string }>;
  average_score?: number;
  score_distribution?: Array<{ score: number; count: number; percentage: number }>;
  reasons?: Array<{ user_name: string; score: number; reason: string; submitted_at: string }>;
  recent_text_answers?: Array<{ user_name: string; username?: string | null; text: string; submitted_at: string }>;
}

interface AnalyticsData {
  summary: {
    total_responses: number;
    overall_avg_satisfaction: number | null;
  };
  question_analytics: QuestionAnalyticsItem[];
}

interface ReportDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  formTitle: string;
  formDescription?: string | null;
  analytics: AnalyticsData;
  totalResponses: number;
}

// Data URL을 바이너리 Blob으로 변환하여 PC/모바일 다운로드 브라우저 호환성을 보장하는 유틸리티
function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);
  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
}

export default function ReportDownloadModal({
  isOpen,
  onClose,
  formTitle,
  formDescription,
  analytics,
  totalResponses
}: ReportDownloadModalProps) {
  const reportRef = useRef<HTMLDivElement>(null);

  // 모든 질문 ID를 기본 선택 상태로 초기화
  const allQuestionIds = analytics.question_analytics.map((q) => q.question_id);
  const [selectedQIds, setSelectedQIds] = useState<string[]>(allQuestionIds);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [reportSortBy, setReportSortBy] = useState<'most_answers' | 'question_order'>('most_answers');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  const toggleQuestion = (qId: string) => {
    setSelectedQIds((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]
    );
  };

  const selectAll = () => setSelectedQIds(allQuestionIds);
  const deselectAll = () => setSelectedQIds([]);

  // 선택된 질문 데이터 필터링
  const selectedQuestions = analytics.question_analytics.filter((q) =>
    selectedQIds.includes(q.question_id)
  );

  // 고화질 이미지(PNG) 다운로드 실행 (Blob Object URL 및 DOM 앵커 클릭으로 PC 완벽 지원)
  const handleDownloadImage = async () => {
    if (!reportRef.current || selectedQuestions.length === 0) return;
    setIsCapturing(true);

    try {
      // 스크롤 영역 전체 펼침 및 폰트/스타일 렌더링 대기
      await new Promise((resolve) => setTimeout(resolve, 300));

      const dataUrl = await toPng(reportRef.current, {
        cacheBust: true,
        pixelRatio: 2, // 고해상도 2배율 캡처
        backgroundColor: '#ffffff'
      });

      const blob = dataUrlToBlob(dataUrl);
      const objectUrl = URL.createObjectURL(blob);

      const safeTitle = formTitle.replace(/[^a-zA-Z0-9가-힣]/g, '_');
      const filename = `FormGram_${safeTitle}_통계리포트.png`;

      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();

      // 파일 다운로드 시작 후 메모리 해제
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(objectUrl);
      }, 5000);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to capture report image:', err);
      alert('리포트 이미지 생성 중 오류가 발생했습니다.');
    } finally {
      setIsCapturing(false);
    }
  };

  // 인쇄 및 PDF 저장 (독립된 히든 iframe을 사용하여 미니앱 배경 중복을 완전히 방지)
  const handlePrint = () => {
    if (!reportRef.current || selectedQuestions.length === 0) return;
    setIsPrinting(true);

    try {
      // 기존에 남아있을 수 있는 인쇄용 iframe 정리
      const existingIframe = document.getElementById('report-print-iframe');
      if (existingIframe) {
        existingIframe.remove();
      }

      // 완전히 격리된 히든 iframe 생성 (미니앱 본문 화면 배제)
      const iframe = document.createElement('iframe');
      iframe.id = 'report-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '1000px';
      iframe.style.height = '1000px';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) {
        alert('인쇄 프레임을 생성할 수 없습니다.');
        setIsPrinting(false);
        return;
      }

      // 현재 페이지의 스타일시트 및 CSS 규칙 복사
      const styleSheets = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
        .map((el) => el.outerHTML)
        .join('\n');

      const safeTitle = formTitle.replace(/[^a-zA-Z0-9가-힣]/g, '_');
      const reportHtml = reportRef.current.innerHTML;

      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="utf-8">
          <title>FormGram_${safeTitle}_통계리포트</title>
          ${styleSheets}
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm 12mm;
            }
            html, body {
              background: #ffffff !important;
              margin: 0 !important;
              padding: 0 !important;
              font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            .print-wrapper {
              width: 100% !important;
              max-width: 780px !important;
              margin: 0 auto !important;
              padding: 0 !important;
              background: #ffffff !important;
            }
            /* 질문 카드가 중간에 잘리지 않고 통째로 다음 페이지로 이동 */
            .question-print-card {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
              display: block !important;
              margin-bottom: 24px !important;
              border: 1px solid #e2e8f0 !important;
              background-color: #f8fafc !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            /* 헤더는 첫 페이지 맨 위에만 위치하고 다음 페이지에 반복되지 않음 */
            .report-header-print {
              break-after: avoid !important;
              page-break-after: avoid !important;
            }
            /* 인쇄 시 스크롤바 감추고 전체 내용 펼침 */
            * {
              overflow: visible !important;
              max-height: none !important;
            }
          </style>
        </head>
        <body>
          <div class="print-wrapper bg-white p-2 space-y-6 text-slate-900">
            ${reportHtml}
          </div>
        </body>
        </html>
      `);
      iframeDoc.close();

      // iframe 렌더링 및 스타일 파싱 완료 대기 후 인쇄 대화상자 호출
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (printErr) {
          console.error('Print execution failed:', printErr);
          alert('인쇄 창을 여는 중 오류가 발생했습니다.');
        } finally {
          setIsPrinting(false);
          // 대화상자 종료 후 40초 뒤 iframe 정리
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 40000);
        }
      }, 500);
    } catch (err) {
      console.error('Failed to prepare print iframe:', err);
      alert('인쇄 준비 중 오류가 발생했습니다.');
      setIsPrinting(false);
    }
  };

  const reportDateStr = formatKstDateTime();

  return (
    <>
      {/* Global Print Styles for Perfect Background & Bar Graph Export */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm 12mm;
          }
          html, body {
            background: #ffffff !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide non-printable modal controls */
          .modal-no-print,
          header,
          nav,
          footer,
          aside {
            display: none !important;
          }
          /* Reset modal wrappers to static document flow */
          .modal-backdrop-print {
            position: static !important;
            display: block !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
          }
          .modal-content-print {
            position: static !important;
            display: block !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .modal-body-print {
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
            display: block !important;
          }
          .modal-canvas-wrapper-print {
            border: none !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            overflow: visible !important;
            display: block !important;
          }
          #report-capture-area {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            overflow: visible !important;
          }
          /* 질문 카드가 중간에 잘리지 않고 통째로 다음 페이지로 넘어가도록 강제 */
          .question-print-card {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            display: block !important;
            margin-bottom: 24px !important;
            border: 1px solid #e2e8f0 !important;
            background-color: #f8fafc !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* 헤더는 첫 페이지 맨 위에만 위치하고 다음 페이지에 반복되지 않음 */
          .report-header-print {
            position: static !important;
            display: block !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      `}</style>

    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto modal-backdrop-print">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 modal-content-print">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0 modal-no-print">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">통계 대시보드 리포트 생성 및 다운로드</h2>
              <p className="text-xs text-slate-500">포함할 질문을 선택하고 고화질 이미지나 PDF로 저장하세요.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Split view (Selector & Action) */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 modal-body-print">
          {/* Question Selector Card */}
          <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-200 space-y-3 modal-no-print">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-800">
                  리포트에 포함할 질문 선택 ({selectedQIds.length} / {allQuestionIds.length}개 선택됨)
                </span>
                <span className="text-[11px] text-slate-400">
                  * 이름이나 연락처 등 민감한 개인정보는 체크 해제할 수 있습니다.
                </span>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={selectAll}
                  className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition"
                >
                  전체 선택
                </button>
                <span className="text-slate-300 text-xs">|</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition"
                >
                  전체 해제
                </button>
                <span className="text-slate-300 text-xs">|</span>
                <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setReportSortBy('most_answers')}
                    className={`px-2 py-0.5 rounded transition ${
                      reportSortBy === 'most_answers' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    답변 많은 순
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportSortBy('question_order')}
                    className={`px-2 py-0.5 rounded transition ${
                      reportSortBy === 'question_order' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    질문 번호 순
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-48 overflow-y-auto pr-1">
              {analytics.question_analytics.map((qa, idx) => {
                const isSelected = selectedQIds.includes(qa.question_id);
                return (
                  <label
                    key={qa.question_id}
                    onClick={() => toggleQuestion(qa.question_id)}
                    className={`flex items-start space-x-2.5 p-3 rounded-xl border text-xs cursor-pointer transition select-none ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-300 text-slate-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="mt-0.5 text-blue-600 shrink-0">
                      {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-300" />}
                    </div>
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <p className="truncate">
                        Q{idx + 1}. {qa.title}
                      </p>
                      <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-normal">
                        <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded">{qa.type}</span>
                        <span>{qa.answered_count}명 응답</span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Report Preview Header */}
          <div className="flex items-center justify-between pt-1 modal-no-print">
            <h3 className="text-xs font-extrabold text-slate-800 flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>리포트 미리보기</span>
            </h3>
            {downloadSuccess && (
              <span className="text-xs font-bold text-emerald-600 flex items-center space-x-1 animate-pulse">
                <CheckCircle2 className="w-4 h-4" />
                <span>이미지가 성공적으로 다운로드되었습니다!</span>
              </span>
            )}
          </div>

          {/* Printable & Capturable Report Canvas */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-slate-100/50 p-2 sm:p-4 modal-canvas-wrapper-print">
            <div
              ref={reportRef}
              id="report-capture-area"
              className="bg-white p-6 sm:p-8 rounded-xl shadow-xs space-y-6 text-slate-900 max-w-3xl mx-auto"
            >
              {/* Report Canvas Header */}
              <div className="border-b-2 border-slate-900/80 pb-5 space-y-3 report-header-print">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-black tracking-wider uppercase">
                      FormGram Report
                    </span>
                    <span className="text-xs font-bold text-slate-400">설문 통계 집계 리포트</span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{reportDateStr} (KST)</span>
                  </div>
                </div>

                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{formTitle}</h1>
                  {formDescription && (
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{formDescription}</p>
                  )}
                </div>

                {/* KPI Summary Badges */}
                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <div className="px-3 py-1.5 bg-blue-50 border border-blue-200/80 rounded-xl flex items-center space-x-1.5 text-xs">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-blue-900 font-bold">총 참여자:</span>
                    <span className="text-blue-700 font-extrabold font-mono">{totalResponses}명</span>
                  </div>
                  <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center space-x-1.5 text-xs">
                    <span className="text-slate-600 font-bold">집계 문항 수:</span>
                    <span className="text-slate-800 font-extrabold font-mono">{selectedQuestions.length}개</span>
                  </div>
                  {analytics.summary.overall_avg_satisfaction !== null && (
                    <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center space-x-1.5 text-xs">
                      <span className="text-amber-800 font-bold">전체 평균 만족도:</span>
                      <span className="text-amber-700 font-extrabold font-mono">
                        ⭐ {analytics.summary.overall_avg_satisfaction} / 5.0
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Questions Statistics List */}
              {selectedQuestions.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 font-medium">
                  선택된 질문이 없습니다. 상단에서 포함할 질문을 선택해 주세요.
                </div>
              ) : (
                <div className="space-y-6">
                  {[...selectedQuestions]
                    .sort((a, b) => {
                      if (reportSortBy === 'most_answers') {
                        return b.answered_count - a.answered_count;
                      }
                      return 0;
                    })
                    .map((qa, qIdx) => {
                    // 1위 항목 계산 (객관식)
                    let topOptionName = '';
                    if (qa.option_breakdown && qa.option_breakdown.length > 0) {
                      const sorted = [...qa.option_breakdown].sort((a, b) => b.count - a.count);
                      if (sorted[0]?.count > 0) {
                        topOptionName = sorted[0].option;
                      }
                    }

                    return (
                      <div
                        key={qa.question_id}
                        className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-4 break-inside-avoid question-print-card"
                      >
                        {/* Question Title & Meta */}
                        <div className="flex items-start justify-between gap-3 border-b border-slate-200/70 pb-3">
                          <div className="space-y-1">
                            <h3 className="font-extrabold text-sm text-slate-900 leading-snug">
                              Q{qIdx + 1}. {qa.title}
                            </h3>
                            <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-medium">
                              <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono">
                                {qa.type}
                              </span>
                              <span>총 {qa.answered_count}명 응답</span>
                            </div>
                          </div>

                          {qa.average_score !== undefined && qa.average_score > 0 && (
                            <div className="px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-xl text-center shrink-0">
                              <span className="text-[10px] font-bold text-indigo-700 block">평균 점수</span>
                              <span className="text-sm font-extrabold text-indigo-950 font-mono">
                                {qa.average_score} / 5.0
                              </span>
                            </div>
                          )}
                        </div>

                        {/* 1. Option Breakdown (SINGLE_CHOICE, MULTIPLE_CHOICE, DROPDOWN) */}
                        {qa.option_breakdown && (
                          <div className="space-y-2.5">
                            {qa.option_breakdown.map((opt, oIdx) => {
                              const isTop = opt.option === topOptionName && opt.count > 0;
                              return (
                                <div key={oIdx} className="space-y-1">
                                  <div className="flex items-center justify-between text-xs font-semibold">
                                    <div className="flex items-center space-x-1.5">
                                      <span className={isTop ? 'text-blue-900 font-bold' : 'text-slate-800'}>
                                        {opt.option}
                                      </span>
                                      {isTop && (
                                        <span className="text-[10px] font-extrabold bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded-md flex items-center space-x-0.5">
                                          <Award className="w-3 h-3" />
                                          <span>1위</span>
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-mono text-slate-700 font-bold">
                                      {opt.count}명 ({opt.percentage}%)
                                    </span>
                                  </div>
                                  <div
                                    className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200"
                                    style={{
                                      backgroundColor: '#f1f5f9',
                                      WebkitPrintColorAdjust: 'exact',
                                      printColorAdjust: 'exact'
                                    }}
                                  >
                                    <div
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        isTop ? 'bg-blue-600' : 'bg-slate-500'
                                      }`}
                                      style={{
                                        width: `${Math.min(100, Math.max(opt.percentage, 0))}%`,
                                        backgroundColor: isTop ? '#2563eb' : '#64748b',
                                        boxShadow: isTop ? 'inset 0 0 0 1000px #2563eb' : 'inset 0 0 0 1000px #64748b',
                                        WebkitPrintColorAdjust: 'exact',
                                        printColorAdjust: 'exact'
                                      }}
                                    ></div>
                                  </div>
                                </div>
                              );
                            })}

                            {/* 기타 직접입력 답변 목록 피드 */}
                            {qa.other_answers && qa.other_answers.length > 0 && (
                              <div className="mt-3 p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                                <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                                  <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                                  <span>직접 작성된 '기타' 의견 ({qa.other_answers.length}건)</span>
                                </h4>
                                <div className={`space-y-1 ${isCapturing ? 'max-h-none overflow-visible' : 'max-h-36 overflow-y-auto'}`}>
                                  {qa.other_answers.map((oa, oaIdx) => (
                                    <div
                                      key={oaIdx}
                                      className="p-2 bg-slate-50 rounded-lg text-xs flex items-center justify-between text-slate-700"
                                    >
                                      <span className="font-medium">• {oa.text}</span>
                                      <span className="text-[10px] text-slate-400 font-mono">({oa.user_name})</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 2. Rating Score Distribution (LINEAR_SCALE, SATISFACTION) */}
                        {qa.score_distribution && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-5 gap-2">
                              {qa.score_distribution.map((sd) => (
                                <div
                                  key={sd.score}
                                  className="bg-white p-2.5 rounded-xl border border-slate-200 text-center space-y-0.5"
                                >
                                  <span className="text-xs font-bold text-slate-700 block">{sd.score}점</span>
                                  <span className="text-sm font-extrabold text-indigo-900 block font-mono">
                                    {sd.count}명
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono block">{sd.percentage}%</span>
                                </div>
                              ))}
                            </div>

                            {/* 만족도 사유 서술 목록 */}
                            {qa.reasons && qa.reasons.length > 0 && (
                              <div className="space-y-2 pt-2 border-t border-slate-200/70">
                                <h4 className="text-xs font-bold text-indigo-950">작성된 평가 사유 ({qa.reasons.length}건)</h4>
                                <div className={`space-y-1.5 ${isCapturing ? 'max-h-none overflow-visible' : 'max-h-36 overflow-y-auto'}`}>
                                  {qa.reasons.map((r, rIdx) => (
                                    <div
                                      key={rIdx}
                                      className="p-2.5 bg-white rounded-xl border border-indigo-100/80 space-y-0.5"
                                    >
                                      <div className="flex items-center justify-between text-[11px] text-indigo-900 font-bold">
                                        <span>{r.user_name} ({r.score}점)</span>
                                      </div>
                                      <p className="text-xs text-slate-700 font-medium">"{r.reason}"</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 3. Text Answers Feed (SHORT_TEXT, LONG_TEXT) */}
                        {qa.recent_text_answers && (
                          <div className="space-y-2">
                            <h4 className="text-xs font-bold text-slate-800">
                              작성된 응답 내용 ({qa.recent_text_answers.length}건)
                            </h4>
                            {qa.recent_text_answers.length === 0 ? (
                              <p className="text-xs text-slate-400 italic">등록된 응답이 없습니다.</p>
                            ) : (
                              <div className={`space-y-1.5 ${isCapturing ? 'max-h-none overflow-visible' : 'max-h-48 overflow-y-auto'}`}>
                                {qa.recent_text_answers.map((ta, tIdx) => (
                                  <div
                                    key={tIdx}
                                    className="p-2.5 bg-white rounded-xl border border-slate-200 text-xs space-y-0.5"
                                  >
                                    <p className="text-slate-800 font-medium">"{ta.text}"</p>
                                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                      <span>작성자: {ta.user_name}</span>
                                      <span>{new Date(ta.submitted_at).toLocaleDateString('ko-KR')}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Report Footer */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                <span>Generated by FormGram Survey Dashboard</span>
                <span>Voice of Youth Admin System</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 modal-no-print">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition"
          >
            닫기
          </button>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={handlePrint}
              disabled={selectedQuestions.length === 0 || isCapturing || isPrinting}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl flex items-center space-x-1.5 transition disabled:opacity-50"
            >
              <Printer className="w-4 h-4 text-slate-700" />
              <span>{isPrinting ? 'PDF 준비 중...' : 'PDF / 인쇄'}</span>
            </button>

            <button
              onClick={handleDownloadImage}
              disabled={selectedQuestions.length === 0 || isCapturing || isPrinting}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow-md active:scale-95 transition disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isCapturing ? '이미지 생성 중...' : '📷 고화질 이미지(PNG) 저장'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

