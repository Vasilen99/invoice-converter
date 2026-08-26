"use client";

import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { OrganizationFormData } from "../../utility/types";
import { useState } from "react";
import { AlertCircle } from "lucide-react";

interface FormFieldProps {
  labelKey: string;
  placeholderKey: string;
  value: string;
  fieldName: string;
  onChange: (field: string, value: string) => void;
  onBlur?: (field: string) => void;
  translations: ReturnType<typeof import("next-intl").useTranslations>;
  maxLength?: number;
  isRequired?: boolean;
  error?: string;
}

function FormField({
  labelKey,
  placeholderKey,
  value,
  fieldName,
  onChange,
  onBlur,
  translations,
  maxLength,
  isRequired = false,
  error,
}: FormFieldProps) {
  const hasError = !!error && error.length > 0;

  return (
    <div className="flex flex-col gap-2 items-start">
      <div className="flex flex-col items-start gap-2">
        <Label className={hasError ? "text-destructive" : ""}>
          {translations(labelKey)}
          {isRequired && <span className="text-destructive">*</span>}
        </Label>
        {hasError && (
          <div className="flex items-center gap-1 text-destructive text-xs">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}
      </div>
      <Input
        placeholder={translations(placeholderKey)}
        value={value}
        onChange={(e) => onChange(fieldName, e.target.value)}
        onBlur={() => onBlur?.(fieldName)}
        maxLength={maxLength}
        className={
          hasError ? "border-destructive focus-visible:ring-destructive" : ""
        }
      />
    </div>
  );
}

// Validation rules
export type ValidationErrors = Partial<Record<string, string>>;

export const validateOrganizationForm = (
  data: OrganizationFormData,
  translations: ReturnType<typeof import("next-intl").useTranslations>,
): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!data.legalName?.trim()) {
    errors.legalName = translations(
      "organizationForm.validation.legalNameRequired",
    );
  }

  if (!data.bulstat?.trim() || data.bulstat.trim().length < 9) {
    errors.bulstat = translations(
      "organizationForm.validation.bulstatRequired",
    );
  }

  if (!data.vatNumber?.trim()) {
    errors.vatNumber = translations(
      "organizationForm.validation.vatNumberRequired",
    );
  }

  if (!data.molName?.trim()) {
    errors.molName = translations(
      "organizationForm.validation.molNameRequired",
    );
  }

  if (!data.address.country?.trim()) {
    errors["address.country"] = translations(
      "organizationForm.validation.countryRequired",
    );
  }

  return errors;
};

export default function ManualAddOrganization({
  formData,
  setFormData,
  translations,
  onValidationChange,
}: {
  formData: OrganizationFormData;
  setFormData: React.Dispatch<React.SetStateAction<OrganizationFormData>>;
  translations: ReturnType<typeof import("next-intl").useTranslations>;
  onValidationChange?: (isValid: boolean) => void;
}) {
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {},
  );
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  const handleChange = (field: string, value: string) => {
    if (field.startsWith("address.")) {
      const addressField = field.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    }

    // Clear error for this field when user starts typing
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Notify parent of validation status
    const errors = validateOrganizationForm(
      field.startsWith("address.")
        ? {
            ...formData,
            address: { ...formData.address, [field.split(".")[1]]: value },
          }
        : { ...formData, [field]: value },
      translations,
    );
    onValidationChange?.(Object.keys(errors).length === 0);
  };

  const handleBlur = (field: string) => {
    setTouchedFields((prev) => new Set([...prev, field]));
    // Validate this specific field
    const errors = validateOrganizationForm(formData, translations);
    if (errors[field]) {
      setValidationErrors((prev) => ({
        ...prev,
        [field]: errors[field],
      }));
    }

    // Notify parent of validation status
    onValidationChange?.(Object.keys(errors).length === 0);
  };

  return (
    <div className="space-y-6 max-h-[60vh] p-4 overflow-auto no-scrollbar">
      {/* Organization Information Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          {translations("organizationForm.organizationMainInformation")}
        </h3>
        <div className="grid lg:grid-cols-2 grid-cols-1 gap-4">
          <FormField
            labelKey="organizationForm.legalNameLabel"
            placeholderKey="organizationForm.legalNamePlaceholder"
            value={formData.legalName}
            fieldName="legalName"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
            isRequired
            error={
              touchedFields.has("legalName")
                ? validationErrors.legalName
                : undefined
            }
          />
          <FormField
            labelKey="organizationForm.bulstatLabel"
            placeholderKey="organizationForm.bulstatPlaceholder"
            value={formData.bulstat}
            fieldName="bulstat"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
            isRequired
            error={
              touchedFields.has("bulstat")
                ? validationErrors.bulstat
                : undefined
            }
          />
          <FormField
            labelKey="organizationForm.vatNumberLabel"
            placeholderKey="organizationForm.vatNumberPlaceholder"
            value={formData.vatNumber}
            fieldName="vatNumber"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
            isRequired
            error={
              touchedFields.has("vatNumber")
                ? validationErrors.vatNumber
                : undefined
            }
          />
          <FormField
            labelKey="organizationForm.molNameLabel"
            placeholderKey="organizationForm.molNamePlaceholder"
            value={formData.molName}
            fieldName="molName"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
            isRequired
            error={
              touchedFields.has("molName")
                ? validationErrors.molName
                : undefined
            }
          />
          <FormField
            labelKey="organizationForm.invoiceSeriesPrefixLabel"
            placeholderKey="organizationForm.invoiceSeriesPrefixPlaceholder"
            value={formData.invoiceSeriesPrefix}
            fieldName="invoiceSeriesPrefix"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
            maxLength={10}
          />
        </div>
      </div>

      {/* Address Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          {translations("organizationForm.organizationAddressInformation")}
        </h3>
        <div className="grid lg:grid-cols-2 grid-cols-1 gap-4">
          <FormField
            labelKey="organizationForm.countryLabel"
            placeholderKey="organizationForm.countryPlaceholder"
            value={formData.address.country}
            fieldName="address.country"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
            isRequired
            error={
              touchedFields.has("address.country")
                ? validationErrors["address.country"]
                : undefined
            }
          />
          <FormField
            labelKey="organizationForm.regionLabel"
            placeholderKey="organizationForm.regionPlaceholder"
            value={formData.address.region}
            fieldName="address.region"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.districtLabel"
            placeholderKey="organizationForm.districtPlaceholder"
            value={formData.address.district}
            fieldName="address.district"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.municipalityLabel"
            placeholderKey="organizationForm.municipalityPlaceholder"
            value={formData.address.municipality}
            fieldName="address.municipality"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.settlementLabel"
            placeholderKey="organizationForm.settlementPlaceholder"
            value={formData.address.settlement}
            fieldName="address.settlement"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.areaLabel"
            placeholderKey="organizationForm.areaPlaceholder"
            value={formData.address.area}
            fieldName="address.area"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.streetLabel"
            placeholderKey="organizationForm.streetPlaceholder"
            value={formData.address.street}
            fieldName="address.street"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.streetNumberLabel"
            placeholderKey="organizationForm.streetNumberPlaceholder"
            value={formData.address.streetNumber}
            fieldName="address.streetNumber"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.blockLabel"
            placeholderKey="organizationForm.blockPlaceholder"
            value={formData.address.block}
            fieldName="address.block"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.entranceLabel"
            placeholderKey="organizationForm.entrancePlaceholder"
            value={formData.address.entrance}
            fieldName="address.entrance"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.floorLabel"
            placeholderKey="organizationForm.floorPlaceholder"
            value={formData.address.floor}
            fieldName="address.floor"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.apartmentLabel"
            placeholderKey="organizationForm.apartmentPlaceholder"
            value={formData.address.apartment}
            fieldName="address.apartment"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.postCodeLabel"
            placeholderKey="organizationForm.postCodePlaceholder"
            value={formData.address.postCode}
            fieldName="address.postCode"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
          />
        </div>
      </div>
    </div>
  );
}
