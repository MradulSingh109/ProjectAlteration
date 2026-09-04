import { DeclarationType } from '@prisma/client';

export interface ExtractedDeclarationItem {
  type: DeclarationType;
  rawValue: string;
  normalizedValue: string | null;
  confidence: number;
}

export class DeclarationParser {
  /**
   * Deterministically parses raw OCR text and extracts Legal Metrology packaging declarations.
   * NEVER invents missing attributes; returns only attributes identified with high confidence.
   */
  static extractDeclarations(rawText: string): ExtractedDeclarationItem[] {
    if (!rawText || typeof rawText !== 'string') {
      return [];
    }

    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const results: ExtractedDeclarationItem[] = [];

    // 1. MRP Extraction
    const mrpItem = this.extractMRP(lines);
    if (mrpItem) results.push(mrpItem);

    // 2. Net Quantity Extraction
    const netQtyItem = this.extractNetQuantity(lines);
    if (netQtyItem) results.push(netQtyItem);

    // 3. Manufacturing Date Extraction
    const mfgDateItem = this.extractMfgDate(lines);
    if (mfgDateItem) results.push(mfgDateItem);

    // 4. Expiry / Best Before Date Extraction
    const expDateItem = this.extractExpDate(lines);
    if (expDateItem) results.push(expDateItem);

    // 5. Consumer Care / Customer Feedback Extraction
    const consumerCareItem = this.extractConsumerCare(lines);
    if (consumerCareItem) results.push(consumerCareItem);

    // 6. Country of Origin Extraction
    const countryItem = this.extractCountryOfOrigin(lines);
    if (countryItem) results.push(countryItem);

    // 7. Commodity / Product Name Extraction
    const commodityItem = this.extractCommodityName(lines);
    if (commodityItem) results.push(commodityItem);

    // 8. Manufacturer / Packer Name & Address Extraction
    const mfgAddrItem = this.extractMfgAddress(lines);
    if (mfgAddrItem) results.push(mfgAddrItem);

    // 9. Importer Details Extraction
    const importerItem = this.extractImporterDetails(lines);
    if (importerItem) results.push(importerItem);

    return results;
  }

  private static extractMRP(lines: string[]): ExtractedDeclarationItem | null {
    const mrpRegex = /(?:m\.?r\.?p\.?|maximum\s+retail\s+price)\s*[:\-\s]*([₹Rs\.]*\s*[\d,]+(?:\.\d{1,2})?)/i;
    const priceStandaloneRegex = /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i;

    for (const line of lines) {
      const match = line.match(mrpRegex);
      if (match) {
        const rawValue = line;
        const numStr = match[1].replace(/[^\d.]/g, '');
        const val = parseFloat(numStr);
        if (!isNaN(val)) {
          return {
            type: DeclarationType.MRP,
            rawValue,
            normalizedValue: JSON.stringify({
              value: val,
              currency: 'INR',
              includesTaxes: /incl|taxes/i.test(line),
            }),
            confidence: 0.95,
          };
        }
      }
    }

    // Secondary fallback for standalone currency markers
    for (const line of lines) {
      if (/mrp/i.test(line)) {
        const match = line.match(priceStandaloneRegex);
        if (match) {
          const val = parseFloat(match[1].replace(/[^\d.]/g, ''));
          if (!isNaN(val)) {
            return {
              type: DeclarationType.MRP,
              rawValue: line,
              normalizedValue: JSON.stringify({
                value: val,
                currency: 'INR',
                includesTaxes: /incl|taxes/i.test(line),
              }),
              confidence: 0.90,
            };
          }
        }
      }
    }

    return null;
  }

  private static extractNetQuantity(lines: string[]): ExtractedDeclarationItem | null {
    const qtyRegex = /(?:net\s+(?:qty|quantity|weight|wt|vol|volume))\s*[:\-\s]*([\d\.]+)\s*([a-zA-Z]+)/i;
    const standaloneQtyRegex = /([\d\.]+)\s*(kg|g|mg|l|ml|pcs|units|n)\b/i;

    for (const line of lines) {
      const match = line.match(qtyRegex);
      if (match) {
        const val = parseFloat(match[1]);
        const unit = match[2].toLowerCase();
        if (!isNaN(val)) {
          return {
            type: DeclarationType.NET_QUANTITY,
            rawValue: line,
            normalizedValue: JSON.stringify({ value: val, unit }),
            confidence: 0.94,
          };
        }
      }
    }

    for (const line of lines) {
      if (/net/i.test(line)) {
        const match = line.match(standaloneQtyRegex);
        if (match) {
          const val = parseFloat(match[1]);
          const unit = match[2].toLowerCase();
          if (!isNaN(val)) {
            return {
              type: DeclarationType.NET_QUANTITY,
              rawValue: line,
              normalizedValue: JSON.stringify({ value: val, unit }),
              confidence: 0.88,
            };
          }
        }
      }
    }

    return null;
  }

  private static extractMfgDate(lines: string[]): ExtractedDeclarationItem | null {
    const mfgRegex = /(?:mfd|mfg(?:\s+date)?|manufactured(?:\s+date)?|pkd|packed(?:\s+date)?|date\s+of\s+(?:mfg|manufacturing|packing))\s*[:\-\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}[\/\-\.]\d{4})/i;

    for (const line of lines) {
      const match = line.match(mfgRegex);
      if (match) {
        const dateStr = match[1];
        return {
          type: DeclarationType.MFG_DATE,
          rawValue: line,
          normalizedValue: JSON.stringify({ dateText: dateStr }),
          confidence: 0.92,
        };
      }
    }

    return null;
  }

  private static extractExpDate(lines: string[]): ExtractedDeclarationItem | null {
    const expRegex = /(?:exp(?:\s+date)?|expiry(?:\s+date)?|best\s+before|use\s+before|date\s+of\s+(?:exp|expiry))\s*[:\-\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}[\/\-\.]\d{4}|\d+\s*months?)/i;

    for (const line of lines) {
      const match = line.match(expRegex);
      if (match) {
        const expStr = match[1];
        return {
          type: DeclarationType.EXP_DATE,
          rawValue: line,
          normalizedValue: JSON.stringify({ dateText: expStr }),
          confidence: 0.90,
        };
      }
    }

    return null;
  }

  private static extractConsumerCare(lines: string[]): ExtractedDeclarationItem | null {
    const careRegex = /(?:consumer\s+care|customer\s+care|helpline|toll\s*free|feedback|contact\s+us)\s*[:\-\s]*(.+)/i;
    const emailPhoneRegex = /(?:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|1800[-_\s]?\d{3}[-_\s]?\d{4})/i;

    for (const line of lines) {
      const match = line.match(careRegex);
      if (match) {
        return {
          type: DeclarationType.CONSUMER_CARE,
          rawValue: line,
          normalizedValue: JSON.stringify({ details: match[1].trim() }),
          confidence: 0.88,
        };
      }
    }

    for (const line of lines) {
      if (emailPhoneRegex.test(line) && /care|support|feedback|contact|help/i.test(line)) {
        return {
          type: DeclarationType.CONSUMER_CARE,
          rawValue: line,
          normalizedValue: JSON.stringify({ details: line.trim() }),
          confidence: 0.85,
        };
      }
    }

    return null;
  }

  private static extractCountryOfOrigin(lines: string[]): ExtractedDeclarationItem | null {
    const countryRegex = /(?:country\s+of\s+origin|made\s+in|product\s+of)\s*[:\-\s]*([a-zA-Z\s]+)/i;

    for (const line of lines) {
      const match = line.match(countryRegex);
      if (match) {
        const country = match[1].trim();
        if (country.length > 2) {
          return {
            type: DeclarationType.COUNTRY_OF_ORIGIN,
            rawValue: line,
            normalizedValue: JSON.stringify({ country }),
            confidence: 0.92,
          };
        }
      }
    }

    return null;
  }

  private static extractCommodityName(lines: string[]): ExtractedDeclarationItem | null {
    const commodityRegex = /(?:commodity(?:\s+name)?|generic\s+name|product\s+name|item\s+name)\s*[:\-\s]*([a-zA-Z0-9\s\-]+)/i;

    for (const line of lines) {
      const match = line.match(commodityRegex);
      if (match) {
        const commodity = match[1].trim();
        if (commodity.length > 1) {
          return {
            type: DeclarationType.COMMODITY_NAME,
            rawValue: line,
            normalizedValue: JSON.stringify({ commodity }),
            confidence: 0.88,
          };
        }
      }
    }

    return null;
  }

  private static extractMfgAddress(lines: string[]): ExtractedDeclarationItem | null {
    const mfgAddrRegex = /(?:manufactured\s+by|mfg\s+by|packed\s+by|marketed\s+by|manufacturer)\s*[:\-\s]*(.+)/i;

    for (const line of lines) {
      const match = line.match(mfgAddrRegex);
      if (match) {
        const details = match[1].trim();
        if (details.length > 3) {
          return {
            type: DeclarationType.MFG_ADDRESS,
            rawValue: line,
            normalizedValue: JSON.stringify({ manufacturerDetails: details }),
            confidence: 0.86,
          };
        }
      }
    }

    return null;
  }

  private static extractImporterDetails(lines: string[]): ExtractedDeclarationItem | null {
    const importerRegex = /(?:imported\s+(?:by|&|and)\s+(?:distributed\s+by)?|importer)\s*[:\-\s]*(.+)/i;

    for (const line of lines) {
      const match = line.match(importerRegex);
      if (match) {
        const details = match[1].trim();
        if (details.length > 3) {
          return {
            type: DeclarationType.IMPORTER_DETAILS,
            rawValue: line,
            normalizedValue: JSON.stringify({ importerDetails: details }),
            confidence: 0.86,
          };
        }
      }
    }

    return null;
  }
}
