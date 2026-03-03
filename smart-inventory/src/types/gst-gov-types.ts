// Government JSON structures for GSTR-1 and GSTR-3B portal filing
// These types mirror the exact format accepted by the GST portal

// ─── GSTR-1 ───────────────────────────────────────────────────────────────────

export interface GovItemDetail {
  txval: number;   // taxable value
  rt: number;      // tax rate %
  iamt: number;    // IGST amount
  camt: number;    // CGST amount
  samt: number;    // SGST amount
  csamt: number;   // cess amount
}

export interface GovItem {
  num: number;
  itm_det: GovItemDetail;
}

export interface GovB2BInvoice {
  inum: string;           // invoice number
  idt: string;            // date DD-MM-YYYY
  val: number;            // total invoice value
  pos: string;            // place of supply (2-digit state code)
  rchrg: "Y" | "N";      // reverse charge
  inv_typ: "R";           // invoice type (Regular)
  itms: GovItem[];
}

export interface GovB2B {
  ctin: string;           // customer GSTIN
  inv: GovB2BInvoice[];
}

export interface GovB2CS {
  sply_ty: "INTRA" | "INTER";
  pos: string;
  typ: "OE";
  txval: number;
  rt: number;
  iamt: number;
  camt: number;
  samt: number;
  csamt: number;
}

export interface GovCDNRNote {
  nt_num: string;          // note number
  nt_dt: string;           // date DD-MM-YYYY
  ntty: "C" | "D";        // C=Credit, D=Debit
  val: number;             // note value
  rchrg: "Y" | "N";
  pos: string;
  inv_typ: "R";
  itms: GovItem[];
}

export interface GovCDNR {
  ctin: string;
  nt: GovCDNRNote[];
}

export interface GovHSNEntry {
  num: number;
  uqc: string;            // unit quantity code
  qty: number;
  hsn_sc: string;          // HSN/SAC code
  txval: number;
  iamt: number;
  camt: number;
  samt: number;
  csamt: number;
  rt: number;
}

export interface GovDocEntry {
  num: number;
  from: string;
  to: string;
  totnum: number;
  cancel: number;
  net_issue: number;
}

export interface GovDocDetail {
  doc_num: number;
  doc_typ: string;
  docs: GovDocEntry[];
}

export interface GSTR1GovJSON {
  gstin: string;
  fp: string;              // filing period MMYYYY
  b2b: GovB2B[];
  b2cs: GovB2CS[];
  cdnr: GovCDNR[];
  hsn: {
    hsn_b2b: GovHSNEntry[];
    hsn_b2c: GovHSNEntry[];
  };
  doc_issue: {
    doc_det: GovDocDetail[];
  };
}

// ─── GSTR-3B ──────────────────────────────────────────────────────────────────

export interface GovTaxRow {
  txval: number;
  iamt: number;
  camt: number;
  samt: number;
  csamt: number;
}

export interface GovITCEntry {
  ty: string;              // IMPG | IMPS | ISRC | ISD | OTH | RUL
  iamt: number;
  camt: number;
  samt: number;
  csamt: number;
}

export interface GovITCNet {
  iamt: number;
  camt: number;
  samt: number;
  csamt: number;
}

export interface GovInwardSupDetail {
  ty: "GST" | "NONGST";
  inter: number;
  intra: number;
}

export interface GovInterSupEntry {
  pos: string;
  txval: number;
  iamt: number;
}

export interface GSTR3BGovJSON {
  gstin: string;
  ret_period: string;      // MMYYYY
  sup_details: {
    osup_det: GovTaxRow;      // 3.1(a) outward taxable
    osup_zero: GovTaxRow;     // 3.1(b) zero-rated
    osup_nil_exmp: GovTaxRow; // 3.1(c) nil/exempt
    isup_rev: GovTaxRow;      // 3.1(d) inward reverse charge
    osup_nongst: GovTaxRow;   // 3.1(e) non-GST
  };
  itc_elg: {
    itc_avl: GovITCEntry[];   // 4(A) ITC available
    itc_rev: GovITCEntry[];   // 4(B) ITC reversed
    itc_net: GovITCNet;       // 4(C) net ITC
    itc_inelg: GovITCEntry[]; // 4(D) ineligible ITC
  };
  inward_sup: {
    isup_details: GovInwardSupDetail[];
  };
  intr_ltfee: {
    intr_details: GovITCNet;
  };
  inter_sup: {
    unreg_details: GovInterSupEntry[];
    comp_details: GovInterSupEntry[];
    uin_details: GovInterSupEntry[];
  };
}
