"use client";

import Swal, { type SweetAlertIcon } from "sweetalert2";

export async function showConfirm(message: string, title = "Xác nhận") {
  const result = await Swal.fire({
    title,
    text: message,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Đồng ý",
    cancelButtonText: "Hủy",
    reverseButtons: true,
    focusCancel: true,
  });

  return result.isConfirmed;
}

export function showToast(message: string, icon: SweetAlertIcon = "success") {
  return Swal.fire({
    toast: true,
    position: "top-end",
    icon,
    title: message,
    showConfirmButton: false,
    timer: 2600,
    timerProgressBar: true,
  });
}

export async function showAlert(message: string, icon: SweetAlertIcon = "info", title = "Thông báo") {
  const hasCustomTitle = title && title !== "Thông báo" && title !== "Lỗi";
  await Swal.fire({
    toast: true,
    position: "top-end",
    icon,
    title: hasCustomTitle ? title : message,
    text: hasCustomTitle ? message : undefined,
    showConfirmButton: false,
    timer: 3500,
    timerProgressBar: true,
  });
}

export function showError(message: string, title = "Lỗi") {
  return showAlert(message, "error", title);
}

export async function showPrompt(message: string, title = "Nhập thông tin") {
  const result = await Swal.fire({
    title,
    text: message,
    input: "text",
    inputAutoTrim: true,
    showCancelButton: true,
    confirmButtonText: "Xác nhận",
    cancelButtonText: "Hủy",
    reverseButtons: true,
  });

  if (result.isDismissed) return null;
  return String(result.value || "");
}
