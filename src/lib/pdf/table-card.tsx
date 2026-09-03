/**
 * Printable QR table-card kit (@react-pdf/renderer). 4 cards per A4 page,
 * 3 style variants designed like letterpress stationery — hosts photograph
 * these for Instagram, so they double as marketing. Uses react-pdf's
 * built-in serif/sans families (Times/Helvetica) since custom TTF hosting
 * isn't wired up server-side; layout/rules carry the "letterpress" feel.
 */
import React from "react";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";

export type CardStyle = "classic" | "minimal" | "playful";

export interface TableCardProps {
  eventTitle: string;
  qrDataUrl: string; // data:image/png;base64,...
  style: CardStyle;
  welcomeMessage?: string | null;
}

const PAGE = { width: 595.28, height: 841.89 }; // A4 in points
const CARD_W = PAGE.width / 2;
const CARD_H = PAGE.height / 2;

const palettes: Record<CardStyle, { ink: string; accent: string; paper: string }> = {
  classic: { ink: "#1C1917", accent: "#C1502E", paper: "#FAF8F5" },
  minimal: { ink: "#1C1917", accent: "#1C1917", paper: "#FFFFFF" },
  playful: { ink: "#1C1917", accent: "#7A8B6F", paper: "#FBF3E7" },
};

function makeStyles(style: CardStyle) {
  const p = palettes[style];
  return StyleSheet.create({
    card: {
      width: CARD_W,
      height: CARD_H,
      padding: 28,
      backgroundColor: p.paper,
      borderWidth: style === "minimal" ? 0.75 : 1,
      borderColor: p.ink,
      alignItems: "center",
      justifyContent: "center",
    },
    rule: {
      width: 64,
      height: style === "playful" ? 0 : 1.5,
      backgroundColor: p.accent,
      marginBottom: 10,
      marginTop: 4,
    },
    eyebrow: {
      fontSize: 9,
      letterSpacing: 3,
      color: p.accent,
      textTransform: "uppercase",
      marginBottom: 8,
      fontFamily: "Helvetica",
    },
    title: {
      fontSize: 20,
      color: p.ink,
      textAlign: "center",
      marginBottom: 10,
      fontFamily: "Times-Italic",
      maxWidth: CARD_W - 80,
    },
    message: {
      fontSize: 9.5,
      color: p.ink,
      textAlign: "center",
      marginBottom: 14,
      lineHeight: 1.5,
      maxWidth: CARD_W - 90,
      fontFamily: "Helvetica",
    },
    qr: {
      width: 108,
      height: 108,
      marginBottom: 12,
    },
    cta: {
      fontSize: 10.5,
      color: p.ink,
      fontFamily: "Helvetica-Bold",
      letterSpacing: 0.5,
    },
    footer: {
      fontSize: 7,
      color: p.accent,
      marginTop: 10,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      fontFamily: "Helvetica",
    },
  });
}

function Card({ eventTitle, qrDataUrl, style, welcomeMessage }: TableCardProps) {
  const s = makeStyles(style);
  return (
    <View style={s.card}>
      <Text style={s.eyebrow}>Share your photos</Text>
      {style !== "minimal" ? <View style={s.rule} /> : null}
      <Text style={s.title}>{eventTitle}</Text>
      <Text style={s.message}>
        {welcomeMessage || "Scan to add your photos and videos — no app, no account needed."}
      </Text>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not DOM img */}
      <Image src={qrDataUrl} style={s.qr} />
      <Text style={s.cta}>SCAN TO UPLOAD</Text>
      <Text style={s.footer}>GuestSnap</Text>
    </View>
  );
}

/** 4-up grid, one A4 page, all four cards identical (cut-and-place on tables). */
export function TableCardPdf(props: TableCardProps) {
  return (
    <Document>
      <Page size="A4" style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} {...props} />
        ))}
      </Page>
    </Document>
  );
}
