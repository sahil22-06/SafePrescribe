"""
PDF Prescription Generation Service
Generates professional PDF prescriptions for download
"""

import io
from datetime import datetime, date
from django.conf import settings
import os
import logging

logger = logging.getLogger(__name__)

# Optional reportlab imports
try:
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
    from reportlab.pdfgen import canvas
    from reportlab.lib.utils import ImageReader
    REPORTLAB_AVAILABLE = True
except ImportError as e:
    logger.warning(f"ReportLab not available: {e}")
    REPORTLAB_AVAILABLE = False

class PrescriptionPDFService:
    def __init__(self):
        if not REPORTLAB_AVAILABLE:
            raise ImportError("ReportLab library is not available. Please install it with: pip install reportlab")
        
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Setup custom paragraph styles for the prescription"""
        # Header style
        self.styles.add(ParagraphStyle(
            name='PrescriptionHeader',
            parent=self.styles['Heading1'],
            fontSize=28,
            spaceAfter=35,
            alignment=TA_CENTER,
            textColor=colors.darkblue,
            fontName='Helvetica-Bold',
            borderWidth=2,
            borderColor=colors.darkblue,
            borderPadding=10,
            backColor=colors.lightblue
        ))
        
        # Doctor info style
        self.styles.add(ParagraphStyle(
            name='DoctorInfo',
            parent=self.styles['Normal'],
            fontSize=13,
            spaceAfter=8,
            alignment=TA_LEFT,
            fontName='Helvetica-Bold',
            textColor=colors.darkgreen
        ))
        
        # Patient info style
        self.styles.add(ParagraphStyle(
            name='PatientInfo',
            parent=self.styles['Normal'],
            fontSize=12,
            spaceAfter=6,
            alignment=TA_LEFT,
            fontName='Helvetica',
            textColor=colors.darkblue
        ))
        
        # Medication header style
        self.styles.add(ParagraphStyle(
            name='MedicationHeader',
            parent=self.styles['Heading2'],
            fontSize=16,
            spaceAfter=15,
            alignment=TA_CENTER,
            textColor=colors.darkred,
            fontName='Helvetica-Bold',
            backColor=colors.lightgrey,
            borderWidth=1,
            borderColor=colors.darkred,
            borderPadding=8
        ))
        
        # Instructions style
        self.styles.add(ParagraphStyle(
            name='Instructions',
            parent=self.styles['Normal'],
            fontSize=10,
            spaceAfter=8,
            alignment=TA_LEFT,
            fontName='Helvetica',
            leftIndent=20
        ))
        
        # Footer style
        self.styles.add(ParagraphStyle(
            name='Footer',
            parent=self.styles['Normal'],
            fontSize=9,
            spaceAfter=6,
            alignment=TA_CENTER,
            textColor=colors.grey,
            fontName='Helvetica'
        ))
    
    def generate_prescription_pdf(self, prescription):
        """Generate a PDF prescription for the given prescription object"""
        try:
            # Create a BytesIO buffer to hold the PDF
            buffer = io.BytesIO()
            
            # Create the PDF document
            doc = SimpleDocTemplate(
                buffer,
                pagesize=A4,
                rightMargin=72,
                leftMargin=72,
                topMargin=72,
                bottomMargin=18
            )
            
            # Build the PDF content
            story = []
            
            # Add header
            story.extend(self._build_header(prescription))
            
            # Add doctor information
            story.extend(self._build_doctor_info(prescription))
            
            # Add patient information
            story.extend(self._build_patient_info(prescription))
            
            # Add prescription date
            story.extend(self._build_prescription_date(prescription))
            
            # Add medications
            story.extend(self._build_medications(prescription))
            
            # Add instructions and notes
            story.extend(self._build_instructions(prescription))
            
            # Add signature line
            story.extend(self._build_signature_section(prescription))
            
            # Add footer
            story.extend(self._build_footer(prescription))
            
            # Build the PDF
            doc.build(story)
            
            # Get the PDF content
            pdf_content = buffer.getvalue()
            buffer.close()
            
            return pdf_content
            
        except Exception as e:
            logger.error(f"Error generating prescription PDF: {e}")
            raise
    
    def _build_header(self, prescription):
        """Build the prescription header"""
        elements = []
        
        # Medical symbol and main title
        header_text = "⚕️ MEDICAL PRESCRIPTION ⚕️"
        elements.append(Paragraph(header_text, self.styles['PrescriptionHeader']))
        
        # Add decorative line
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("─" * 80, self.styles['Normal']))
        elements.append(Spacer(1, 20))
        
        return elements
    
    def _build_doctor_info(self, prescription):
        """Build doctor information section"""
        elements = []
        
        # Doctor information header with medical symbol
        elements.append(Paragraph("👨‍⚕️ PRESCRIBER INFORMATION", self.styles['Heading2']))
        elements.append(Spacer(1, 10))
        
        # Doctor information
        doctor_info = [
            f"<b>Dr. {prescription.prescriber.get_full_name()}</b>",
            f"Medical License: {getattr(prescription.prescriber, 'license_number', None) or 'N/A'}",
            f"Specialization: {getattr(prescription.prescriber, 'specialization', None) or 'General Practice'}",
            f"Contact: {getattr(prescription.prescriber, 'phone', None) or 'N/A'}",
            f"Email: {prescription.prescriber.email or 'N/A'}"
        ]
        
        for info in doctor_info:
            elements.append(Paragraph(info, self.styles['DoctorInfo']))
        
        elements.append(Spacer(1, 20))
        return elements
    
    def _build_patient_info(self, prescription):
        """Build patient information section"""
        elements = []
        
        # Patient information header with medical symbol
        elements.append(Paragraph("👤 PATIENT INFORMATION", self.styles['Heading2']))
        elements.append(Spacer(1, 10))
        
        # Patient information
        patient = prescription.patient
        age = self._calculate_age(patient.date_of_birth)
        
        patient_info = [
            f"<b>Patient Name:</b> {patient.first_name} {patient.last_name}",
            f"<b>Age:</b> {age} years | <b>Gender:</b> {patient.get_gender_display()}",
            f"<b>Date of Birth:</b> {patient.date_of_birth.strftime('%B %d, %Y')}",
            f"<b>Phone:</b> {patient.phone or 'N/A'}",
            f"<b>Address:</b> {patient.address or 'N/A'}"
        ]
        
        if patient.weight_kg and patient.height_cm:
            bmi = self._calculate_bmi(patient.weight_kg, patient.height_cm)
            patient_info.append(f"<b>Weight:</b> {patient.weight_kg} kg | <b>Height:</b> {patient.height_cm} cm | <b>BMI:</b> {bmi}")
        
        if patient.blood_type:
            patient_info.append(f"<b>Blood Type:</b> {patient.blood_type}")
        
        for info in patient_info:
            elements.append(Paragraph(info, self.styles['PatientInfo']))
        
        elements.append(Spacer(1, 20))
        return elements
    
    def _build_prescription_date(self, prescription):
        """Build prescription date section"""
        elements = []
        
        date_str = prescription.created_at.strftime('%B %d, %Y at %I:%M %p')
        elements.append(Paragraph(f"<b>Prescription Date:</b> {date_str}", self.styles['PatientInfo']))
        elements.append(Spacer(1, 15))
        
        return elements
    
    def _build_medications(self, prescription):
        """Build medications section"""
        elements = []
        
        elements.append(Paragraph("💊 PRESCRIBED MEDICATIONS 💊", self.styles['MedicationHeader']))
        elements.append(Spacer(1, 15))
        
        # Create medications table
        medications = prescription.prescription_medications.all()
        
        if medications:
            # Table headers
            table_data = [['Medication', 'Dosage', 'Frequency', 'Duration', 'Quantity', 'Refills']]
            
            # Add medication data
            for med in medications:
                drug = med.drug
                table_data.append([
                    f"{drug.name}\n({drug.generic_name})",
                    f"{med.dosage} {getattr(drug, 'unit', '')}",
                    med.frequency,
                    f"{med.duration} days",
                    str(med.quantity),
                    str(med.refills)
                ])
            
            # Create table
            table = Table(table_data, colWidths=[2*inch, 1*inch, 1*inch, 1*inch, 0.8*inch, 0.8*inch])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.darkred),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 11),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 15),
                ('TOPPADDING', (0, 0), (-1, 0), 15),
                ('BACKGROUND', (0, 1), (-1, -1), colors.lightgrey),
                ('GRID', (0, 0), (-1, -1), 1, colors.darkred),
                ('FONTSIZE', (0, 1), (-1, -1), 10),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
            ]))
            
            elements.append(table)
        else:
            elements.append(Paragraph("No medications prescribed.", self.styles['Normal']))
        
        elements.append(Spacer(1, 20))
        return elements
    
    def _build_instructions(self, prescription):
        """Build instructions and notes section"""
        elements = []
        
        elements.append(Paragraph("📋 INSTRUCTIONS & MEDICAL NOTES 📋", self.styles['MedicationHeader']))
        elements.append(Spacer(1, 15))
        
        # Add general instructions
        if prescription.instructions:
            elements.append(Paragraph(f"<b>Instructions:</b> {prescription.instructions}", self.styles['Instructions']))
        
        # Add patient allergies
        patient = prescription.patient
        allergies = patient.patient_allergies.all()
        if allergies:
            allergy_names = [allergy.allergy.name for allergy in allergies]
            elements.append(Paragraph(f"<b>Known Allergies:</b> {', '.join(allergy_names)}", self.styles['Instructions']))
        
        # Add medical history if significant
        if patient.medical_history:
            elements.append(Paragraph(f"<b>Medical History:</b> {patient.medical_history[:200]}{'...' if len(patient.medical_history) > 200 else ''}", self.styles['Instructions']))
        
        # Add special considerations
        special_notes = []
        if patient.kidney_function and patient.kidney_function != 'Normal':
            special_notes.append(f"Kidney function: {patient.kidney_function}")
        if patient.liver_function and patient.liver_function != 'Normal':
            special_notes.append(f"Liver function: {patient.liver_function}")
        if patient.pregnancy_status:
            special_notes.append("Patient is pregnant")
        if patient.breastfeeding:
            special_notes.append("Patient is breastfeeding")
        
        if special_notes:
            elements.append(Paragraph(f"<b>Special Considerations:</b> {'; '.join(special_notes)}", self.styles['Instructions']))
        
        elements.append(Spacer(1, 20))
        return elements
    
    def _build_signature_section(self, prescription):
        """Build signature section"""
        elements = []
        
        elements.append(Spacer(1, 40))
        elements.append(Paragraph("✍️ PHYSICIAN SIGNATURE", self.styles['Heading2']))
        elements.append(Spacer(1, 20))
        
        # Signature line with medical symbol
        elements.append(Paragraph("Doctor's Signature: _________________________", self.styles['Normal']))
        elements.append(Spacer(1, 15))
        elements.append(Paragraph(f"Dr. {prescription.prescriber.get_full_name()}", self.styles['DoctorInfo']))
        elements.append(Paragraph(f"Medical License: {getattr(prescription.prescriber, 'license_number', None) or 'N/A'}", self.styles['Normal']))
        elements.append(Paragraph(f"Date: {prescription.created_at.strftime('%B %d, %Y')}", self.styles['Normal']))
        elements.append(Spacer(1, 30))
        
        return elements
    
    def _build_footer(self, prescription):
        """Build footer section"""
        elements = []
        
        elements.append(Spacer(1, 30))
        elements.append(Paragraph("─" * 80, self.styles['Normal']))
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("🏥 Generated by SafePrescribe Medical System 🏥", self.styles['Footer']))
        elements.append(Paragraph(f"Prescription ID: {prescription.id}", self.styles['Footer']))
        elements.append(Paragraph(f"Generated on: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}", self.styles['Footer']))
        elements.append(Paragraph("This is a computer-generated prescription", self.styles['Footer']))
        
        return elements
    
    def _calculate_age(self, birth_date):
        """Calculate age from birth date"""
        today = date.today()
        return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
    
    def _calculate_bmi(self, weight_kg, height_cm):
        """Calculate BMI from weight and height"""
        if not weight_kg or not height_cm:
            return "N/A"
        
        height_m = height_cm / 100
        bmi = weight_kg / (height_m ** 2)
        return f"{bmi:.1f}"
