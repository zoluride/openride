-- Add additional driver document types for Hackney permit and motor insurance
alter type public.driver_doc_type add value if not exists 'hackney_permit';
alter type public.driver_doc_type add value if not exists 'motor_insurance';
