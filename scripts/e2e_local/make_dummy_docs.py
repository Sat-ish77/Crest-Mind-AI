"""Generate fictional property documents with known ground-truth facts."""
import os
import sys

import fitz
from docx import Document

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

# 1) Lease (DOCX) -- Maple Ridge Plaza
d = Document()
d.add_paragraph("COMMERCIAL LEASE AGREEMENT")
d.add_paragraph("Property: Maple Ridge Plaza, Austin TX")
d.add_paragraph("This Lease is made between Cedar Holdings LP (Landlord) and "
                "Sunny Paws Pet Supply LLC (Tenant).")
d.add_paragraph("1. LEASE TERM")
d.add_paragraph("The Lease Term begins January 1, 2024 and ends December 31, 2033. "
                "Tenant has two options to extend for five years each with 90 days notice.")
d.add_paragraph("2. BASE RENT")
d.add_paragraph("Tenant shall pay Base Rent of $4,250.00 per month for the 2,400 square foot premises. "
                "Rent increases 3% annually on each anniversary.")
d.add_paragraph("3. HVAC MAINTENANCE")
d.add_paragraph("Tenant is responsible for routine HVAC maintenance and quarterly filter changes. "
                "Landlord is responsible for replacement of any HVAC unit when repair cost exceeds $5,000.")
d.add_paragraph("4. EXCLUSIVE USE")
d.add_paragraph("Tenant has the exclusive right to operate a pet supply store in the center. "
                "This exclusive use clause expires on December 31, 2029.")
d.add_paragraph("5. TRIPLE NET")
d.add_paragraph("This is a NNN lease. Tenant pays its prorata share of CAM, taxes and insurance, "
                "estimated at $1.85 per square foot per year.")
d.save(os.path.join(OUT, "Maple Ridge Plaza - Lease 2024.docx"))

# 2) Amendment (DOCX) -- Harbor Point Center (SOLD property)
d = Document()
d.add_paragraph("FIRST AMENDMENT TO LEASE")
d.add_paragraph("Property: Harbor Point Center, Wilmington NC")
d.add_paragraph("Tenant: Blue Heron Coffee Co.")
d.add_paragraph("1. EXTENSION OF TERM")
d.add_paragraph("The term of the lease is extended through June 30, 2031.")
d.add_paragraph("2. RENT ADJUSTMENT")
d.add_paragraph("Effective July 1, 2026 monthly Base Rent shall be $5,100.00.")
d.save(os.path.join(OUT, "Harbor Point Amendment 1.docx"))

# 3) Invoice (PDF) -- ductwork
pdf = fitz.open()
p = pdf.new_page()
p.insert_text((50, 60), "INVOICE #7781", fontsize=14)
lines = [
    "Lone Star Mechanical Services",
    "Property: Maple Ridge Plaza",
    "",
    "Ductwork replacement - Suite 104",
    "Labor: $7,980.50",
    "Materials: $4,500.00",
    "",
    "Total Due: $12,480.50",
    "Invoice date: March 3, 2026",
]
y = 90
for ln in lines:
    p.insert_text((50, y), ln, fontsize=11)
    y += 18
pdf.save(os.path.join(OUT, "Ductwork Invoice 7781.pdf"))

# 4) Inspection (2-page PDF) -- answer sits on page 2
pdf = fitz.open()
p1 = pdf.new_page()
p1.insert_text((50, 60), "HVAC INSPECTION REPORT", fontsize=14)
p1.insert_text((50, 90), "Property: Harbor Point Center", fontsize=11)
p1.insert_text((50, 108), "Inspector: J. Alvarez, inspected May 12, 2026", fontsize=11)
p1.insert_text((50, 126), "Units inspected: RTU-1, RTU-2, RTU-3", fontsize=11)
p2 = pdf.new_page()
p2.insert_text((50, 60), "FINDINGS", fontsize=14)
p2.insert_text((50, 90), "RTU-3 compressor failure detected. Unit age 14 years.", fontsize=11)
p2.insert_text((50, 108), "Estimated compressor replacement cost: $3,900.", fontsize=11)
pdf.save(os.path.join(OUT, "HVAC Inspection Harbor Point.pdf"))

print("\n".join(sorted(os.listdir(OUT))))
