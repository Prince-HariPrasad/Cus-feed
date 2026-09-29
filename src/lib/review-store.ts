"use client";

import { useSyncExternalStore } from "react";
import { OUTLETS, type Review } from "./types";

const KEY = "outlet-pulse.reviews.v1";
let memoryValue: string | null = null;
let memoryOnly = false;

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("reviews-updated", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("reviews-updated", callback);
  };
}

function snapshot() {
  try {
    return memoryOnly ? memoryValue : localStorage.getItem(KEY);
  } catch {
    return memoryValue;
  }
}

function isReview(value: unknown): value is Review {
  if (!value || typeof value !== "object") return false;
  const review = value as Review;
  return (
    typeof review.id === "string" &&
    typeof review.text === "string" &&
    typeof review.customer === "string" &&
    typeof review.rationale === "string" &&
    OUTLETS.some((outlet) => outlet.id === review.outletId) &&
    Number.isFinite(Date.parse(review.createdAt)) &&
    (review.sentiment === "POSITIVE" || review.sentiment === "NEGATIVE") &&
    Number.isFinite(review.confidence) &&
    review.confidence >= 0 &&
    review.confidence <= 1 &&
    (review.source === "demo" || review.source === "huggingface") &&
    Array.isArray(review.drivers) &&
    review.drivers.every(
      (driver) =>
        driver &&
        typeof driver.phrase === "string" &&
        typeof driver.topic === "string" &&
        (driver.sentiment === "POSITIVE" || driver.sentiment === "NEGATIVE") &&
        Number.isInteger(driver.start) &&
        Number.isInteger(driver.end) &&
        driver.start >= 0 &&
        driver.end <= review.text.length &&
        driver.end > driver.start,
    )
  );
}

function parse(raw: string | null): Review[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(value) ? value.filter(isReview) : [];
  } catch {
    return [];
  }
}

export function useSavedReviews() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  return parse(raw);
}

export function saveReview(review: Review) {
  const value = JSON.stringify([review, ...parse(snapshot())].slice(0, 300));
  memoryValue = value;
  try {
    localStorage.setItem(KEY, value);
    memoryOnly = false;
  } catch {
    memoryOnly = true;
  }
  window.dispatchEvent(new Event("reviews-updated"));
  return !memoryOnly;
}
