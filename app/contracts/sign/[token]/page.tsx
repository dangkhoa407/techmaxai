"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { fetchContractSigning, submitContractSigning, type AdminContract, type ContractData } from "../../../lib/auth";

function PaperInput({
  value,
  onChange,
  placeholder = "",
  width = 220,
  type = "text",
  readOnly = false,
}: {
  value: string | number | null | undefined;
  onChange?: (value: string) => void;
  placeholder?: string;
  width?: number | string;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <input
      className="contract-paper-input"
      type={type}
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder={placeholder}
      style={{ width }}
      readOnly={readOnly}
    />
  );
}

function dateParts(value?: string | null) {
  if (!value) return { day: "", month: "", year: "" };
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return { day: "", month: "", year: "" };
  return {
    day: String(date.getDate()).padStart(2, "0"),
    month: String(date.getMonth() + 1).padStart(2, "0"),
    year: String(date.getFullYear()),
  };
}

function removeSignatureBackground(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Cannot read signature file."));
    reader.onload = () => {
      const tempImg = new Image();
      tempImg.onerror = () => reject(new Error("Cannot load signature image."));
      tempImg.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(String(reader.result || ""));
          return;
        }

        canvas.width = tempImg.width;
        canvas.height = tempImg.height;
        ctx.drawImage(tempImg, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const w = canvas.width;
        const h = canvas.height;
        const coords = [
          { x: Math.min(5, w - 1), y: Math.min(5, h - 1) },
          { x: Math.max(0, w - 6), y: Math.min(5, h - 1) },
          { x: Math.min(5, w - 1), y: Math.max(0, h - 6) },
          { x: Math.max(0, w - 6), y: Math.max(0, h - 6) },
        ];

        let bgR = 0;
        let bgG = 0;
        let bgB = 0;
        coords.forEach((coord) => {
          const idx = (coord.y * w + coord.x) * 4;
          bgR += data[idx];
          bgG += data[idx + 1];
          bgB += data[idx + 2];
        });
        bgR = Math.round(bgR / 4);
        bgG = Math.round(bgG / 4);
        bgB = Math.round(bgB / 4);
        const bgBrightness = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] === 0) continue;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
          const colorDist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

          if (colorDist < 75 || brightness >= bgBrightness - 15) {
            data[i + 3] = 0;
          } else {
            const factor = 0.7;
            data[i] = Math.max(0, Math.round(r * factor));
            data[i + 1] = Math.max(0, Math.round(g * factor));
            data[i + 2] = Math.max(0, Math.round(b * factor));
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      tempImg.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

function PartyBlock({
  title,
  party,
  onChange,
  businessName,
  readOnly = false,
}: {
  title: string;
  party: ContractData["party_a"] | ContractData["party_b"];
  onChange?: (key: keyof ContractData["party_a"], value: string) => void;
  businessName?: boolean;
  readOnly?: boolean;
}) {
  return (
    <div className="contract-party-block">
      <div className="contract-card-title">{title}</div>
      <div>Tên {businessName ? "doanh nghiệp" : "doanh nghiệp/cá nhân"}: <PaperInput value={party.name} onChange={(value) => onChange?.("name", value)} readOnly={readOnly} width={360} /></div>
      <div>Địa chỉ: <PaperInput value={party.address} onChange={(value) => onChange?.("address", value)} readOnly={readOnly} width={470} /></div>
      <div>Mã số thuế: <PaperInput value={party.tax_code} onChange={(value) => onChange?.("tax_code", value)} readOnly={readOnly} width={220} /></div>
      <div>Người đại diện: <PaperInput value={party.representative} onChange={(value) => onChange?.("representative", value)} readOnly={readOnly} width={260} /></div>
      <div>Chức vụ: <PaperInput value={party.position} onChange={(value) => onChange?.("position", value)} readOnly={readOnly} width={260} /></div>
      <div>Số CCCD/CMND: <PaperInput value={party.citizen_id} onChange={(value) => onChange?.("citizen_id", value)} readOnly={readOnly} width={240} /></div>
      <div>Ngày cấp: <PaperInput value={party.issued_date} onChange={(value) => onChange?.("issued_date", value)} readOnly={readOnly} placeholder="dd/mm/yyyy" width={170} /></div>
      <div>Nơi cấp: <PaperInput value={party.issued_place} onChange={(value) => onChange?.("issued_place", value)} readOnly={readOnly} width={260} /></div>
      <div>Điện thoại: <PaperInput value={party.phone} onChange={(value) => onChange?.("phone", value)} readOnly={readOnly} width={230} /></div>
      <div>Email: <PaperInput value={party.email} onChange={(value) => onChange?.("email", value)} readOnly={readOnly} width={300} type="email" /></div>
      {"website" in party ? (
        <div>Website: <PaperInput value={(party as ContractData["party_b"]).website} onChange={(value) => onChange?.("website" as keyof ContractData["party_a"], value)} readOnly={readOnly} width={280} /></div>
      ) : null}
    </div>
  );
}

export default function ContractSigningPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const pageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [contract, setContract] = useState<AdminContract | null>(null);
  const [partyA, setPartyA] = useState<ContractData["party_a"]>({
    name: "",
    address: "",
    tax_code: "",
    representative: "",
    position: "",
    citizen_id: "",
    issued_date: "",
    issued_place: "",
    phone: "",
    email: "",
  });
  const [signerName, setSignerName] = useState("");
  const [signatureData, setSignatureData] = useState("");
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  useEffect(() => {
    fetchContractSigning(token)
      .then((data) => {
        setContract(data);
        setPartyA({ ...partyA, ...(data.data.party_a || {}) });
        setSignerName(data.data.signers?.party_a || data.data.party_a?.representative || "");
        setSignatureData(data.party_a_signature_data || data.data.signatures?.party_a || "");
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "Không thể tải hợp đồng.");
        setMessageType("error");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const data = useMemo(() => {
    if (!contract) return null;
    return {
      ...contract.data,
      party_a: {
        ...contract.data.party_a,
        ...partyA,
      },
      signers: {
        ...contract.data.signers,
        party_a: signerName,
      },
      signatures: {
        ...contract.data.signatures,
        party_a: signatureData,
      },
    } as ContractData;
  }, [contract, partyA, signerName, signatureData]);

  function updatePartyA(key: keyof ContractData["party_a"], value: string) {
    setPartyA((current) => ({ ...current, [key]: value }));
  }

  function onSignatureFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Vui lòng chọn file hình ảnh.");
      setMessageType("error");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setMessage("Ảnh chữ ký không được vượt quá 3MB.");
      setMessageType("error");
      return;
    }
    removeSignatureBackground(file)
      .then(setSignatureData)
      .catch(() => {
        const reader = new FileReader();
        reader.onload = () => setSignatureData(String(reader.result || ""));
        reader.readAsDataURL(file);
      });
  }

  function printContract() {
    document.body.classList.add("contract-printing");
    const cleanup = () => {
      document.body.classList.remove("contract-printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    window.setTimeout(cleanup, 1000);
  }

  async function downloadPdf() {
    if (!pageRef.current) return;

    document.body.classList.add("contract-pdf-export");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(pageRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;
      const pxToMm = contentWidth / canvas.width;
      const maxSlicePx = Math.floor(contentHeight / pxToMm);
      const whiteThreshold = 248;
      const watermark = pageRef.current.querySelector(".contract-watermark") as HTMLImageElement | null;

      const isBlankRow = (y: number) => {
        const ctx = canvas.getContext("2d");
        if (!ctx) return false;
        const step = 8;
        const row = ctx.getImageData(0, y, canvas.width, 1).data;
        for (let x = 0; x < canvas.width; x += step) {
          const idx = x * 4;
          if (row[idx + 3] > 10 && (row[idx] < whiteThreshold || row[idx + 1] < whiteThreshold || row[idx + 2] < whiteThreshold)) {
            return false;
          }
        }
        return true;
      };

      let sourceY = 0;
      while (sourceY < canvas.height) {
        if (sourceY > 0) pdf.addPage();
        const targetEnd = Math.min(sourceY + maxSlicePx, canvas.height);
        let sliceEnd = targetEnd;
        if (targetEnd < canvas.height) {
          for (let y = targetEnd; y > Math.max(sourceY + Math.floor(maxSlicePx * 0.72), targetEnd - 220); y -= 1) {
            if (isBlankRow(y)) {
              sliceEnd = y;
              break;
            }
          }
        }
        const sliceHeight = Math.max(1, sliceEnd - sourceY);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const pageCtx = pageCanvas.getContext("2d");
        if (pageCtx) {
          pageCtx.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
          if (watermark?.complete && watermark.naturalWidth > 0 && watermark.naturalHeight > 0) {
            const wmWidth = Math.min(pageCanvas.width * 0.68, 620);
            const wmHeight = wmWidth * (watermark.naturalHeight / watermark.naturalWidth);
            pageCtx.save();
            pageCtx.globalAlpha = 0.08;
            pageCtx.translate(pageCanvas.width / 2, pageCanvas.height / 2);
            pageCtx.rotate((-28 * Math.PI) / 180);
            pageCtx.drawImage(watermark, -wmWidth / 2, -wmHeight / 2, wmWidth, wmHeight);
            pageCtx.restore();
          }
        }
        pdf.addImage(pageCanvas.toDataURL("image/png"), "PNG", margin, margin, contentWidth, sliceHeight * pxToMm);
        sourceY = sliceEnd;
      }

      pdf.save(`${String(contract?.contract_code || "hop-dong").replace(/[\\/:*?"<>|]/g, "-")}.pdf`);
    } finally {
      document.body.classList.remove("contract-pdf-export");
    }
  }

  async function onSubmit() {
    setSaving(true);
    setMessage("");
    try {
      const updated = await submitContractSigning(token, {
        party_a: partyA,
        signer_name: signerName,
        signature_data: signatureData,
        agree,
      });
      setContract(updated);
      setMessage("Đã lưu thông tin và chữ ký Bên A.");
      setMessageType("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể lưu hợp đồng.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="contract-page"><div className="contract-paper-wrap"><div className="contract-paper">Đang tải hợp đồng...</div></div><ContractSignStyles /></div>;
  }

  if (!data || !contract) {
    return <div className="contract-page"><div className="contract-paper-wrap"><div className="contract-paper">{message || "Không tìm thấy hợp đồng."}</div></div><ContractSignStyles /></div>;
  }

  const parts = dateParts(data.contract_date);

  return (
    <div className="contract-page">
      <div className="contract-paper-wrap">
        <div className="contract-paper" ref={pageRef}>
          <img src="/contracts/logo.png" className="contract-watermark" alt="" aria-hidden="true" loading="lazy" decoding="async" />


          <div className="contract-center">
            <p><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></p>
            <p><strong><u>Độc lập - Tự do - Hạnh phúc</u></strong></p>
          </div>

          <h1>
            <PaperInput value={(data.title || "").toUpperCase()} readOnly width="100%" />
          </h1>

          <p className="contract-center">
            Số: <PaperInput value={data.contract_code || ""} readOnly width={220} />
          </p>

          <p>
            Căn cứ Bộ luật Dân sự số 91/2015/QH13 ngày 24/11/2015; căn cứ Luật Thương mại hiện hành; căn cứ nhu cầu sử dụng
            dịch vụ AI hỗ trợ bán hàng, chăm sóc khách hàng và khả năng cung cấp dịch vụ của các bên.
          </p>

          <p>
            Hôm nay, ngày <PaperInput value={parts.day} readOnly width={55} />
            tháng <PaperInput value={parts.month} readOnly width={55} />
            năm <PaperInput value={parts.year} readOnly width={80} />,
            tại <PaperInput value={data.signing_place || ""} readOnly width={150} />,
            chúng tôi gồm có:
          </p>

          <div className="contract-parties">
            <PartyBlock title="Bên A - Bên sử dụng dịch vụ" party={partyA} onChange={updatePartyA} />
            <PartyBlock title="Bên B - Bên cung cấp dịch vụ" party={data.party_b} readOnly businessName />
          </div>

          <h2>Điều 1. Đối tượng hợp đồng</h2>
          <p>Bên B cung cấp cho Bên A dịch vụ AI hỗ trợ bán hàng, chăm sóc khách hàng và tự động hóa quy trình kinh doanh trên các nền tảng như Facebook Messenger, Fanpage, Website hoặc các kênh khác theo thỏa thuận.</p>
          <ul>
            <li>AI trả lời tin nhắn khách hàng tự động.</li>
            <li>AI tư vấn sản phẩm, dịch vụ theo dữ liệu Bên A cung cấp.</li>
            <li>AI hỗ trợ tra cứu đơn hàng, trạng thái thanh toán, thông tin khách hàng nếu được tích hợp API.</li>
            <li>Dashboard quản trị, cấu hình và theo dõi hoạt động AI.</li>
            <li>Đào tạo, tinh chỉnh AI theo dữ liệu của Bên A.</li>
          </ul>

          <h2>Điều 2. Phạm vi dịch vụ</h2>
          <p>Bên B chỉ chịu trách nhiệm cung cấp dịch vụ trong phạm vi tính năng đã thỏa thuận. Các yêu cầu phát sinh ngoài phạm vi hợp đồng sẽ được báo giá và thỏa thuận riêng.</p>
          <p>Bên B không chịu trách nhiệm đối với lỗi phát sinh từ nền tảng bên thứ ba như Facebook, Messenger, Zalo, nhà cung cấp AI, ngân hàng, cổng thanh toán, hosting, domain hoặc API bên ngoài.</p>

          <h2>Điều 3. Thời hạn dịch vụ</h2>
          <p>
            Thời hạn sử dụng dịch vụ bắt đầu từ ngày <PaperInput value={data.service.start_date} readOnly placeholder="dd/mm/yyyy" width={140} />
            đến ngày <PaperInput value={data.service.end_date} readOnly placeholder="dd/mm/yyyy" width={140} />.
          </p>
          <p>Sau khi hết thời hạn, nếu Bên A tiếp tục thanh toán phí dịch vụ thì hợp đồng được hiểu là tiếp tục gia hạn theo chu kỳ thanh toán tương ứng.</p>

          <h2>Điều 4. Phí dịch vụ và thanh toán</h2>
          <p>
            Gói dịch vụ:{" "}
            <select className="contract-paper-select" value={data.service.package} onChange={() => null} disabled>
              <option>Starter</option>
              <option>Business</option>
              <option>Enterprise</option>
            </select>
          </p>
          <p>Giá trị hợp đồng: <PaperInput value={data.service.value || ""} readOnly placeholder="Số tiền VNĐ" width={180} type="number" /> đồng.</p>
          <p>Bằng chữ: <PaperInput value={data.service.value_text} readOnly placeholder="Số tiền bằng chữ" width={500} /></p>
          <p>
            Phương thức thanh toán:{" "}
            <select className="contract-paper-select" value={data.service.payment_method} onChange={() => null} disabled>
              <option>Chuyển khoản</option>
              <option>Tiền mặt</option>
            </select>
          </p>
          <p>
            Nếu quá hạn thanh toán quá <PaperInput value={data.service.overdue_days || ""} readOnly width={60} /> ngày, Bên B có quyền tạm ngừng cung cấp dịch vụ mà không phải bồi thường.
          </p>
          <p>Phí đã thanh toán sẽ không được hoàn lại nếu Bên B đã triển khai, bàn giao hoặc kích hoạt dịch vụ cho Bên A, trừ khi hai bên có thỏa thuận khác bằng văn bản.</p>

          <h2>Điều 5. Quyền và nghĩa vụ của Bên A</h2>
          <ul>
            <li>Cung cấp đầy đủ, chính xác và hợp pháp các dữ liệu cần thiết để đào tạo AI.</li>
            <li>Chịu trách nhiệm về nội dung sản phẩm, giá bán, chính sách bảo hành, đổi trả, hoàn tiền.</li>
            <li>Thanh toán đầy đủ và đúng hạn.</li>
            <li>Không sử dụng hệ thống cho mục đích lừa đảo, spam, giả mạo hoặc vi phạm pháp luật.</li>
            <li>Chủ động kiểm tra các phản hồi quan trọng của AI liên quan đến báo giá, thanh toán, hợp đồng và giao dịch giá trị cao.</li>
          </ul>

          <h2>Điều 6. Quyền và nghĩa vụ của Bên B</h2>
          <ul>
            <li>Triển khai, vận hành và hỗ trợ kỹ thuật cho hệ thống AI theo phạm vi đã thỏa thuận.</li>
            <li>Bảo mật dữ liệu do Bên A cung cấp.</li>
            <li>Hỗ trợ điều chỉnh, tối ưu AI trong phạm vi gói dịch vụ.</li>
            <li>Có quyền từ chối xử lý các yêu cầu vi phạm pháp luật hoặc trái đạo đức xã hội.</li>
            <li>Có quyền tạm ngừng hoặc chấm dứt dịch vụ nếu Bên A vi phạm nghĩa vụ thanh toán hoặc sử dụng dịch vụ sai mục đích.</li>
          </ul>

          <h2>Điều 7. Bảo mật thông tin và dữ liệu</h2>
          <p>Bên B cam kết bảo mật thông tin kinh doanh, dữ liệu khách hàng, dữ liệu đơn hàng, nội dung đào tạo AI và các tài liệu do Bên A cung cấp.</p>
          <p>Bên B không bán, chuyển giao hoặc chia sẻ dữ liệu của Bên A cho bên thứ ba nếu không có sự đồng ý của Bên A, trừ trường hợp có yêu cầu từ cơ quan nhà nước có thẩm quyền.</p>
          <p>Bên A chịu trách nhiệm về tính hợp pháp của toàn bộ dữ liệu, hình ảnh, tài liệu, nội dung, thông tin khách hàng và thông tin sản phẩm được cung cấp cho Bên B.</p>

          <h2>Điều 8. Giới hạn trách nhiệm đối với AI</h2>
          <p>Bên A hiểu rằng AI là công cụ hỗ trợ tự động hóa, không phải con người thực tế và không thể bảo đảm chính xác tuyệt đối trong mọi trường hợp.</p>
          <p>AI có thể phát sinh sai sót, hiểu nhầm ngữ cảnh, trả lời thiếu thông tin hoặc đưa ra nội dung chưa hoàn toàn chính xác.</p>
          <p>Bên B không chịu trách nhiệm đối với các thiệt hại trực tiếp hoặc gián tiếp phát sinh từ việc Bên A sử dụng kết quả do AI tạo ra mà không kiểm tra lại.</p>
          <p>Trong mọi trường hợp, tổng trách nhiệm bồi thường của Bên B, nếu có, không vượt quá tổng phí dịch vụ mà Bên A đã thanh toán trong 03 tháng gần nhất.</p>

          <h2>Điều 9. Sở hữu trí tuệ</h2>
          <p>Toàn bộ phần mềm, mã nguồn, giao diện, thuật toán, hệ thống AI, workflow, prompt hệ thống, tài liệu kỹ thuật và các thành phần công nghệ thuộc quyền sở hữu của Bên B.</p>
          <p>Bên A chỉ được quyền sử dụng dịch vụ trong thời hạn hợp đồng, không được sao chép, bán lại, cho thuê lại, dịch ngược, trích xuất mã nguồn hoặc sử dụng hệ thống để xây dựng sản phẩm cạnh tranh với Bên B.</p>

          <h2>Điều 10. Tạm ngừng và chấm dứt dịch vụ</h2>
          <p>Bên B có quyền tạm ngừng hoặc chấm dứt dịch vụ nếu Bên A:</p>
          <ul>
            <li>Chậm thanh toán quá thời hạn thỏa thuận.</li>
            <li>Sử dụng dịch vụ vào mục đích vi phạm pháp luật.</li>
            <li>Cung cấp dữ liệu sai sự thật hoặc dữ liệu vi phạm quyền của bên thứ ba.</li>
            <li>Cố tình can thiệp, phá hoại hoặc khai thác trái phép hệ thống.</li>
          </ul>

          <h2>Điều 11. Bất khả kháng</h2>
          <p>Bên B không chịu trách nhiệm đối với việc gián đoạn dịch vụ do thiên tai, chiến tranh, mất điện diện rộng, sự cố Internet, lỗi từ nhà cung cấp máy chủ, nền tảng mạng xã hội, ngân hàng, cổng thanh toán hoặc nhà cung cấp mô hình AI.</p>

          <h2>Điều 12. Nghiệm thu và bàn giao</h2>
          <p>Dịch vụ được xem là đã nghiệm thu khi Bên B đã kích hoạt hệ thống, cấu hình AI cơ bản, bàn giao tài khoản hoặc cung cấp quyền truy cập cho Bên A.</p>
          <p>
            Nếu trong vòng <PaperInput value={data.service.acceptance_days || ""} readOnly width={60} /> ngày kể từ ngày bàn giao mà Bên A không có phản hồi bằng văn bản, dịch vụ được xem là đã được nghiệm thu.
          </p>

          <h2>Điều 13. Giải quyết tranh chấp</h2>
          <p>13.1. Trong quá trình thực hiện Hợp đồng, mọi tranh chấp, bất đồng hoặc khiếu nại phát sinh liên quan đến việc ký kết, thực hiện, sửa đổi, chấm dứt hoặc giải thích các điều khoản của Hợp đồng này sẽ được các bên ưu tiên giải quyết thông qua thương lượng và hòa giải trên tinh thần hợp tác, thiện chí và tôn trọng quyền lợi hợp pháp của nhau.</p>
          <p>13.2. Bên phát sinh khiếu nại phải thông báo bằng văn bản cho bên còn lại trong thời hạn không quá 30 ngày kể từ ngày phát sinh sự kiện tranh chấp. Trong vòng 15 ngày làm việc kể từ ngày nhận được thông báo, các bên có trách nhiệm tiến hành trao đổi và tìm biện pháp giải quyết.</p>
          <p>13.3. Trong thời gian giải quyết tranh chấp, các nội dung không liên quan trực tiếp đến tranh chấp vẫn phải tiếp tục được các bên thực hiện đầy đủ theo quy định của Hợp đồng.</p>
          <p>13.4. Trường hợp các bên không thể giải quyết tranh chấp bằng thương lượng trong thời hạn 30 ngày kể từ ngày phát sinh tranh chấp, một trong các bên có quyền đưa vụ việc ra Tòa án nhân dân có thẩm quyền nơi Bên B đặt trụ sở chính để giải quyết theo quy định của pháp luật Việt Nam.</p>
          <p>13.5. Phán quyết hoặc bản án có hiệu lực pháp luật của Tòa án là quyết định cuối cùng và có giá trị bắt buộc thi hành đối với các bên.</p>
          <p>13.6. Luật áp dụng để giải quyết mọi tranh chấp phát sinh từ Hợp đồng này là pháp luật nước Cộng hòa xã hội chủ nghĩa Việt Nam.</p>

          <h2>Điều 14. Hiệu lực hợp đồng</h2>
          <p>14.1. Hợp đồng này có hiệu lực kể từ thời điểm các bên hoàn tất việc ký kết bằng chữ ký trực tiếp, chữ ký điện tử hoặc hình thức xác nhận điện tử hợp pháp khác.</p>
          <p>14.2. Hợp đồng có giá trị pháp lý tương đương bản giấy trong trường hợp được ký kết, xác nhận hoặc lưu trữ dưới hình thức điện tử thông qua hệ thống của Bên B hoặc nền tảng ký kết điện tử hợp pháp.</p>
          <p>14.3. Các phụ lục, biên bản bàn giao, biên bản nghiệm thu, báo giá, thông báo gia hạn, email xác nhận hoặc tài liệu điện tử được các bên xác nhận là một phần không tách rời của Hợp đồng này.</p>
          <p>14.4. Mọi sửa đổi, bổ sung Hợp đồng chỉ có giá trị khi được lập thành văn bản hoặc được xác nhận thông qua hệ thống điện tử của các bên.</p>
          <p>14.5. Trường hợp một hoặc nhiều điều khoản của Hợp đồng bị cơ quan có thẩm quyền tuyên vô hiệu thì các điều khoản còn lại vẫn giữ nguyên hiệu lực.</p>
          <p>14.6. Hợp đồng được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản; hoặc được lưu trữ dưới dạng điện tử trên hệ thống của Bên B.</p>
          <p>14.7. Bằng việc ký kết hoặc xác nhận điện tử, các bên cam kết đã đọc, hiểu rõ toàn bộ nội dung Hợp đồng, tự nguyện giao kết và cam kết thực hiện đầy đủ các quyền và nghĩa vụ đã thỏa thuận.</p>

          <div className="contract-notice">
            Bằng việc ký kết hoặc xác nhận điện tử, các bên cam kết đã đọc, hiểu rõ toàn bộ nội dung Hợp đồng,
            tự nguyện giao kết và cam kết thực hiện đầy đủ các quyền, nghĩa vụ đã thỏa thuận.
          </div>

          <label className="contract-agree">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            Tôi xác nhận đã đọc, hiểu và đồng ý với toàn bộ nội dung hợp đồng.
          </label>

          <div className="contract-sign-area">
            <div className="contract-sign-col">
              <p><strong>ĐẠI DIỆN BÊN A</strong></p>
              <p>(Ký, ghi rõ họ tên, đóng dấu nếu có)</p>

              <input type="file" ref={fileRef} accept="image/*" style={{ display: "none" }} onChange={(e) => onSignatureFile(e.target.files?.[0])} />

              <div className="contract-sign-box" onClick={() => fileRef.current?.click()}>
                {signatureData ? (
                  <img src={signatureData} alt="Chữ ký Bên A" />
                ) : (
                  <span>Vùng chữ ký Bên A</span>
                )}
              </div>

              {signatureData ? (
                <button className="contract-remove-sign" type="button" onClick={() => setSignatureData("")}>
                  Xóa chữ ký
                </button>
              ) : null}

              <p className={!signatureData ? "contract-signer-empty" : ""}>
                <PaperInput value={signerName} onChange={setSignerName} placeholder="Người ký Bên A" width={250} />
              </p>
            </div>

            <div className="contract-sign-col">
              <p><strong>ĐẠI DIỆN BÊN B</strong></p>
              <p>(Ký, ghi rõ họ tên, đóng dấu nếu có)</p>

              <div className="contract-sign-box contract-sign-box-readonly">
                {contract.party_b_signature_data || data.signatures?.party_b ? (
                  <img src={(contract.party_b_signature_data || data.signatures?.party_b) ?? undefined} alt="Chữ ký Bên B" style={{ display: "block", maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                ) : (
                  <span>Bên B ký sau</span>
                )}
              </div>

              <p className={!(contract.party_b_signature_data || data.signatures?.party_b) ? "contract-signer-empty" : ""}>
                <span className="contract-readonly-signer">{data.signers?.party_b || "Đại diện Bên B"}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="actions">
        {message ? <span className={`msg ${messageType}`}>{message}</span> : null}
        <button type="button" onClick={printContract}>
          In / Lưu PDF
        </button>
        <button type="button" onClick={downloadPdf}>
          Tải PDF
        </button>
        <button className="primary" type="button" disabled={saving} onClick={onSubmit}>
          {saving ? "Đang lưu..." : "Xác nhận hợp đồng"}
        </button>
      </div>
      <ContractSignStyles />
    </div>
  );
}

function ContractSignStyles() {
  return (
    <style jsx global>{`
      .contract-page * {
        box-sizing: border-box;
      }
      .contract-page {
        margin: 0;
        min-height: 100vh;
        background: #f2f2f2;
        font-family: var(--font-ui);
        color: #000;
        padding-bottom: 60px;
      }
      .contract-paper-wrap {
        padding: 30px 24px;
        max-width: 950px;
        margin: 0 auto;
      }
      .contract-paper {
        max-width: 900px;
        margin: 0 auto;
        background: #ffffff;
        color: #000000;
        padding: 45px 60px;
        box-shadow: 0 0 12px rgba(0, 0, 0, 0.12);
        font-family: var(--font-ui);
        position: relative;
      }
      .contract-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
        border-bottom: 2px solid #000;
        padding-bottom: 15px;
      }
      .contract-logo {
        width: 210px;
        height: auto;
      }
      .contract-company {
        font-size: 14px;
        line-height: 1.5;
        text-align: right;
        color: #000;
      }
      .contract-paper > :not(.contract-watermark) {
        position: relative;
        z-index: 1;
      }
      .contract-watermark {
        position: absolute;
        top: 330px;
        left: 50%;
        width: 560px;
        max-width: 78%;
        opacity: 0.08;
        transform: translateX(-50%) rotate(-28deg);
        transform-origin: center;
        pointer-events: none;
        user-select: none;
        z-index: 0;
      }
      .contract-paper h1 {
        text-align: center;
        font-size: 24px;
        margin: 25px 0 8px;
        text-transform: uppercase;
      }
      .contract-paper h1 .contract-paper-input {
        width: 100% !important;
        max-width: 100%;
        border: none;
        text-align: center;
        font-size: 24px;
        font-weight: bold;
        text-transform: uppercase;
        padding: 0;
      }
      .contract-paper h2 {
        font-size: 17px;
        margin-top: 22px;
        font-weight: bold;
      }
      .contract-paper p,
      .contract-paper li,
      .contract-paper div,
      .contract-paper label {
        font-size: 16px;
        line-height: 1.6;
      }
      .contract-paper p,
      .contract-paper li {
        text-align: justify;
      }
      .contract-paper p:has(.contract-paper-input),
      .contract-paper p:has(.contract-paper-select),
      .contract-paper .field:has(.contract-paper-input),
      .contract-paper .field:has(.contract-paper-select) {
        text-align: left;
        text-align-last: auto;
      }
      .contract-center,
      .contract-center p {
        text-align: center;
      }
      .contract-paper p.contract-center {
        text-align: center;
      }
      .contract-center:has(.contract-paper-input),
      .contract-center p:has(.contract-paper-input) {
        text-align: center;
      }
      .contract-paper-input,
      .contract-paper-select {
        border: none;
        border-bottom: 1px dotted #000;
        font-family: var(--font-ui);
        font-size: 16px;
        padding: 3px;
        outline: none;
        background: transparent;
        color: #000;
        max-width: 100%;
      }
      .contract-paper p .contract-paper-input {
        width: auto !important;
        min-width: 2ch;
        max-width: 100%;
        field-sizing: content;
      }
      .contract-paper p .contract-paper-select {
        width: auto !important;
        field-sizing: content;
      }
      .contract-paper-select {
        border: 1px solid #999;
        min-width: 150px;
      }
      .contract-parties {
        display: flex;
        flex-direction: column;
        gap: 24px;
        margin: 24px 0;
      }
      .contract-party-block {
        margin: 14px 0 18px;
      }
      .contract-party-block > div {
        margin: 7px 0;
      }
      .contract-readonly-empty {
        display: inline-block;
        width: 260px;
        border-bottom: 1px dotted #000;
        vertical-align: baseline;
      }
      .contract-party-readonly .contract-readonly-empty {
        min-height: 1.2em;
      }
      .contract-readonly-signer {
        display: inline-block;
        min-width: 250px;
        border-bottom: 1px dotted #000;
        color: #52525b;
      }
      .contract-card-title {
        font-weight: bold;
      }
      .contract-agree {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-top: 18px;
      }
      .contract-agree input {
        width: auto;
      }
      .contract-sign-area {
        display: flex;
        justify-content: space-between;
        gap: 40px;
        margin-top: 40px;
      }
      .contract-sign-col {
        width: 48%;
        text-align: center;
      }
      .contract-sign-box {
        height: 130px;
        border: 1px dashed #777;
        margin-top: 12px;
        display: flex;
        justify-content: center;
        align-items: center;
        color: #71717a;
        cursor: pointer;
        overflow: hidden;
      }
      .contract-sign-box img {
        max-width: 90%;
        max-height: 115px;
        object-fit: contain;
      }
      .contract-remove-sign {
        margin-top: 8px;
        padding: 6px 10px;
        border: 1px solid #999;
        background: #fff;
        cursor: pointer;
        font-family: var(--font-ui);
      }
      .actions {
        position: sticky;
        bottom: 0;
        background: #fff;
        padding: 12px;
        text-align: center;
        border-top: 1px solid #ccc;
        z-index: 100;
      }
      .actions button {
        padding: 10px 18px;
        border: 1px solid #444;
        background: #fff;
        cursor: pointer;
        margin: 4px;
        font-family: inherit;
        font-size: 15px;
        font-weight: 500;
      }
      .actions button:hover {
        background: #f4f4f5;
        border-color: #a1a1aa;
      }
      .actions button.primary {
        background: #18181b;
        color: #fff;
        border-color: #18181b;
      }
      .actions button.primary:hover {
        background: #27272a;
      }
      .actions button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .msg {
        display: block;
        margin-bottom: 12px;
        font-weight: 600;
        font-size: 15px;
      }
      .msg.success {
        color: #15803d;
      }
      .msg.error {
        color: #b91c1c;
      }
      @media screen and (max-width: 768px) {
        .contract-paper-wrap {
          padding: 10px;
        }
        .contract-paper {
          padding: 25px;
          box-shadow: none;
        }
        .contract-sign-area {
          flex-direction: column;
        }
        .contract-sign-col {
          width: 100%;
        }
        .contract-paper-input {
          width: 100% !important;
        }
      }
      @media print {
        html,
        body {
          background: #fff !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .contract-page {
          background: #fff !important;
          padding-bottom: 0 !important;
        }
        .contract-paper-wrap {
          border: none !important;
          border-radius: 0 !important;
          padding: 0 !important;
          background: #fff !important;
          overflow: visible !important;
        }
        .contract-paper {
          box-shadow: none !important;
          margin: 0 !important;
          padding: 45px 18px !important;
          max-width: 900px !important;
        }
        .contract-watermark {
          position: fixed !important;
          top: 42% !important;
          left: 50% !important;
          width: 560px !important;
          max-width: 78% !important;
          opacity: 0.08 !important;
          transform: translate(-50%, -50%) rotate(-28deg) !important;
        }
        .contract-paper-input,
        .contract-paper-select,
        .contract-readonly-empty,
        .contract-readonly-signer {
          border: none !important;
        }
        .contract-sign-box {
          border: none !important;
        }
        .contract-sign-box span,
        .contract-signer-empty,
        .contract-signer-empty * {
          display: none !important;
        }
        .actions,
        .contract-remove-sign {
          display: none !important;
        }
        @page {
          size: auto;
          margin: 15mm;
          @bottom-center {
            content: "Trang " counter(page);
            font-family: var(--font-ui);
            font-size: 11pt;
          }
        }
        .contract-sign-area {
          display: flex !important;
          flex-direction: row !important;
          justify-content: space-between !important;
          gap: 40px !important;
        }
        .contract-sign-col {
          width: 48% !important;
        }
      }
      .contract-exporting .contract-paper-input {
        border: none !important;
      }
      .contract-pdf-export .contract-paper-wrap {
        border: none !important;
        border-radius: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        overflow: visible !important;
      }
      .contract-pdf-export .contract-paper {
        box-shadow: none !important;
        font-size: 14.5pt !important;
        line-height: 1.56 !important;
        margin: 0 !important;
        padding: 0 18px !important;
        max-width: 900px !important;
      }
      .contract-pdf-export .contract-paper p,
      .contract-pdf-export .contract-paper li,
      .contract-pdf-export .contract-paper div,
      .contract-pdf-export .contract-paper label {
        font-size: 14.5pt !important;
        line-height: 1.56 !important;
      }
      .contract-pdf-export .contract-paper h2 {
        font-size: 16pt !important;
        margin-top: 18px !important;
      }
      .contract-pdf-export .contract-watermark {
        position: fixed !important;
        top: 42% !important;
        left: 50% !important;
        width: 560px !important;
        max-width: 78% !important;
        opacity: 0.08 !important;
        transform: translate(-50%, -50%) rotate(-28deg) !important;
      }
      .contract-pdf-export .contract-sign-area {
        display: flex !important;
        flex-direction: row !important;
        justify-content: space-between !important;
        gap: 40px !important;
      }
      .contract-pdf-export .contract-sign-col {
        width: 48% !important;
      }
      .contract-pdf-export .contract-paper-input,
      .contract-pdf-export .contract-paper-select,
      .contract-pdf-export .contract-readonly-empty,
      .contract-pdf-export .contract-readonly-signer {
        border: none !important;
      }
      .contract-pdf-export .contract-sign-box {
        border: none !important;
      }
      .contract-pdf-export .actions,
      .contract-pdf-export .contract-remove-sign,
      .contract-pdf-export .contract-sign-box span,
      .contract-pdf-export .contract-signer-empty,
      .contract-pdf-export .contract-signer-empty * {
        display: none !important;
      }
      .contract-printing .contract-paper-input {
        border: none !important;
      }
      .contract-exporting .contract-paper-select,
      .contract-printing .contract-paper-select {
        border: none !important;
      }
      .contract-exporting .contract-remove-sign {
        display: none !important;
      }
      .contract-exporting .contract-sign-box span,
      .contract-exporting .contract-signer-empty,
      .contract-exporting .contract-signer-empty * {
        display: none !important;
      }
      .contract-printing .contract-remove-sign {
        display: none !important;
      }
      .contract-printing .contract-sign-box span,
      .contract-printing .contract-signer-empty,
      .contract-printing .contract-signer-empty * {
        display: none !important;
      }
    `}</style>
  );
}
