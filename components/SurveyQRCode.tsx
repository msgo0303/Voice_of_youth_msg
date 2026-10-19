'use client';

import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Download,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { sanitizeQrFilename, isClipboardImageSupported } from '@/lib/qrCodeHelper';

interface SurveyQRCodeProps {
  formId: string;
  formTitle: string;
  surveyUrl: string;
  className?: string;
  compact?: boolean;
}

export default function SurveyQRCode({
  formId,
  formTitle,
  surveyUrl,
  className = '',
  compact = false,
}: SurveyQRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dataUrl, setDataUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [qrError, setQrError] = useState<string | null>(null);

  // Feedback states
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedImage, setCopiedImage] = useState<boolean>(false);
  const [copyImageNotice, setCopyImageNotice] = useState<string | null>(null);
  const [copyImageError, setCopyImageError] = useState<string | null>(null);

  // Render QR Code onto canvas and generate high-res PNG data URL
  const generateQR = async () => {
    setLoading(true);
    setQrError(null);
    try {
      if (!surveyUrl) {
        throw new Error('설문 링크가 제공되지 않았습니다.');
      }

      // Generate preview data URL (512x512)
      const url = await QRCode.toDataURL(surveyUrl, {
        width: 512,
        margin: 3,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });

      setDataUrl(url);

      // Also render into canvas for direct clipboard blob generation
      if (canvasRef.current) {
        await QRCode.toCanvas(canvasRef.current, surveyUrl, {
          width: 512,
          margin: 3,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });
      }
    } catch (err: any) {
      console.error('QR code generation error:', err);
      setQrError('QR 코드를 생성하지 못했습니다. 아래 설문 링크를 직접 사용해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateQR();
  }, [surveyUrl]);

  // 1. Download PNG Image
  const handleDownloadImage = async () => {
    try {
      // Create a high-res (1024x1024) PNG for crisp scanning & printing
      const highResUrl = await QRCode.toDataURL(surveyUrl, {
        width: 1024,
        margin: 4,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });

      const fileName = sanitizeQrFilename(formTitle);

      const downloadLink = document.createElement('a');
      downloadLink.href = highResUrl;
      downloadLink.download = fileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (err) {
      console.error('Failed to download QR code image:', err);
      // Fallback: open in new tab if direct download failed
      if (dataUrl) {
        const win = window.open('');
        if (win) {
          win.document.write(`<img src="${dataUrl}" alt="FormGram QR Code" style="max-width:100%;height:auto;"/>`);
        } else {
          alert('이미지 저장을 완료할 수 없습니다. 이미지를 길게 누르거나 우클릭하여 저장해 주세요.');
        }
      }
    }
  };

  // 2. Copy Image to Clipboard
  const handleCopyImage = async () => {
    setCopyImageError(null);
    setCopyImageNotice(null);

    // Check Clipboard API & ClipboardItem support
    if (!isClipboardImageSupported()) {
      setCopyImageError('현재 브라우저/환경에서는 클립보드 이미지 복사를 지원하지 않습니다. 대신 "이미지 저장"을 이용해 주세요.');
      return;
    }

    try {
      let blob: Blob | null = null;

      // Method A: use canvas.toBlob
      if (canvasRef.current) {
        blob = await new Promise<Blob | null>((resolve) => {
          canvasRef.current?.toBlob((b) => resolve(b), 'image/png');
        });
      }

      // Method B: fetch from dataUrl if canvas blob was unavailable
      if (!blob && dataUrl) {
        const res = await fetch(dataUrl);
        blob = await res.blob();
      }

      if (!blob) {
        throw new Error('QR 이미지 Blob을 생성할 수 없습니다.');
      }

      const clipboardItem = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([clipboardItem]);

      setCopiedImage(true);
      setCopyImageNotice('QR 코드 이미지가 복사되었습니다.');
      setTimeout(() => {
        setCopiedImage(false);
        setCopyImageNotice(null);
      }, 3000);
    } catch (err: any) {
      console.warn('Clipboard image copy failed:', err);
      setCopyImageError('이미지 복사에 실패했습니다. 브라우저 보안 정책이나 환경에 따라 지원되지 않을 수 있으니 "이미지 저장"을 이용해 주세요.');
    }
  };

  // 3. Copy Survey Link
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(surveyUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4 ${className}`}
      data-testid="survey-qr-section"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm">설문 QR 코드</h3>
            <p className="text-[11px] text-slate-500">
              스마트폰 카메라로 스캔하면 텔레그램 설문 페이지로 바로 연결됩니다.
            </p>
          </div>
        </div>

        {surveyUrl && (
          <a
            href={surveyUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center space-x-1 hover:underline"
            title="새 창에서 설문 링크 열기"
          >
            <span>열기</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Main Content Area: Left QR Preview, Right Details & Buttons */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-5">
        {/* QR Code Preview Box */}
        <div className="flex flex-col items-center flex-shrink-0">
          <div className="relative w-44 h-44 sm:w-48 sm:h-48 bg-white p-3 rounded-2xl border border-slate-200 shadow-inner flex items-center justify-center">
            {loading && (
              <div className="flex flex-col items-center justify-center space-y-2 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <span className="text-[11px]">QR 생성 중...</span>
              </div>
            )}

            {qrError && (
              <div className="p-3 text-center space-y-1 text-rose-600">
                <AlertCircle className="w-6 h-6 mx-auto" />
                <p className="text-[10px] leading-tight">{qrError}</p>
              </div>
            )}

            {/* Hidden canvas for toBlob & ClipboardItem */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Rendered QR Image */}
            {!loading && !qrError && dataUrl && (
              <img
                src={dataUrl}
                alt={`QR Code - ${formTitle}`}
                className="w-full h-full object-contain"
                data-testid="qr-preview-image"
              />
            )}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 font-medium">
            권장 스캔 거리: 20cm ~ 1m
          </p>
        </div>

        {/* Details & Action Controls */}
        <div className="flex-1 w-full space-y-3.5">
          {/* Survey Title */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              설문 제목
            </label>
            <p className="text-sm font-extrabold text-slate-900 break-words mt-0.5">
              {formTitle || '무제 설문'}
            </p>
          </div>

          {/* Survey Target URL */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                연결 대상 설문 링크
              </label>
              <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                텔레그램 미니앱 공식 링크
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2">
              <p
                className="text-xs font-mono text-slate-700 break-all select-all flex-1"
                data-testid="survey-target-url"
              >
                {surveyUrl}
              </p>
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-2.5 py-1 text-xs font-bold text-blue-700 hover:text-blue-900 hover:bg-blue-100/70 rounded-lg transition flex items-center space-x-1 flex-shrink-0"
                title="설문 링크 복사"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-extrabold">복사됨!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>링크 복사</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Action Buttons: Save Image / Copy Image / Copy Link */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* 1. 이미지 저장 버튼 */}
            <button
              type="button"
              onClick={handleDownloadImage}
              disabled={loading || !!qrError}
              className="flex-1 sm:flex-initial min-w-[130px] px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 shadow-sm transition disabled:opacity-50"
              data-testid="btn-save-qr-image"
            >
              <Download className="w-4 h-4" />
              <span>이미지 저장</span>
            </button>

            {/* 2. 이미지 복사 버튼 */}
            <button
              type="button"
              onClick={handleCopyImage}
              disabled={loading || !!qrError}
              className={`flex-1 sm:flex-initial min-w-[130px] px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 border transition disabled:opacity-50 ${
                copiedImage
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
              }`}
              data-testid="btn-copy-qr-image"
            >
              {copiedImage ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">이미지 복사됨!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-600" />
                  <span>이미지 복사</span>
                </>
              )}
            </button>

            {/* 3. 설문 링크 복사 버튼 */}
            <button
              type="button"
              onClick={handleCopyLink}
              disabled={!surveyUrl}
              className="flex-1 sm:flex-initial min-w-[130px] px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition"
              data-testid="btn-copy-survey-link"
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">링크 복사됨!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-600" />
                  <span>설문 링크 복사</span>
                </>
              )}
            </button>
          </div>

          {/* Feedback Notices */}
          {copyImageNotice && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center space-x-2 animate-in fade-in duration-150">
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{copyImageNotice}</span>
            </div>
          )}

          {copyImageError && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-start space-x-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{copyImageError}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
