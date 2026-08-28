"use client";

import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { OrganizationFormData, ContragentFormData } from "../../utility/types";
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

  if (!data.name?.trim()) {
    errors.name = translations("organizationForm.validation.legalNameRequired");
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

export const validateContragentForm = (
  data: ContragentFormData,
  translations: ReturnType<typeof import("next-intl").useTranslations>,
): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!data.name?.trim()) {
    errors.name = translations("contragentForm.validation.nameRequired");
  }

  // Bulstat is optional for contragents but if provided should be valid
  if (
    data.bulstat &&
    data.bulstat.trim().length > 0 &&
    data.bulstat.trim().length < 9
  ) {
    errors.bulstat = translations("contragentForm.validation.bulstatInvalid");
  }

  // Email is optional but if provided should be valid
  if (
    data.email &&
    data.email.trim().length > 0 &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
  ) {
    errors.email = translations("contragentForm.validation.emailInvalid");
  }

  if (!data.address.country?.trim()) {
    errors["address.country"] = translations(
      "contragentForm.validation.countryRequired",
    );
  }

  return errors;
};

// Overload signatures
export default function ManualAddOrganization({
  formData,
  setFormData,
  translations,
  onValidationChange,
  isContragent = false,
}: {
  formData: OrganizationFormData | ContragentFormData;
  setFormData:
    | React.Dispatch<React.SetStateAction<OrganizationFormData>>
    | React.Dispatch<React.SetStateAction<ContragentFormData>>;
  translations: ReturnType<typeof import("next-intl").useTranslations>;
  onValidationChange?: (isValid: boolean) => void;
  isContragent?: boolean;
}) {
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {},
  );
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  const handleChange = (field: string, value: string) => {
    if (field.startsWith("address.")) {
      const addressField = field.split(".")[1];
      setFormData((prev: any) => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value,
        },
      }));
    } else {
      setFormData((prev: any) => ({
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

    // Notify parent of validation status using the appropriate validator
    const updatedData = field.startsWith("address.")
      ? {
          ...formData,
          address: { ...formData.address, [field.split(".")[1]]: value },
        }
      : { ...formData, [field]: value };

    const errors = isContragent
      ? validateContragentForm(updatedData as ContragentFormData, translations)
      : validateOrganizationForm(
          updatedData as OrganizationFormData,
          translations,
        );

    onValidationChange?.(Object.keys(errors).length === 0);
  };

  const handleBlur = (field: string) => {
    setTouchedFields((prev) => new Set([...prev, field]));
    // Validate this specific field using the appropriate validator
    const errors = isContragent
      ? validateContragentForm(formData as ContragentFormData, translations)
      : validateOrganizationForm(
          formData as OrganizationFormData,
          translations,
        );

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
      {/* Organization/Contragent Information Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          {isContragent
            ? translations("contragentForm.contragentMainInformation")
            : translations("organizationForm.organizationMainInformation")}
        </h3>
        <div className="grid lg:grid-cols-2 grid-cols-1 gap-4">
          {isContragent ? (
            <>
              {/* Contragent fields */}
              <FormField
                labelKey="contragentForm.nameLabel"
                placeholderKey="contragentForm.namePlaceholder"
                value={(formData as ContragentFormData).name}
                fieldName="name"
                onChange={handleChange}
                onBlur={handleBlur}
                translations={translations}
                isRequired
                error={
                  touchedFields.has("name") ? validationErrors.name : undefined
                }
              />
              <FormField
                labelKey="contragentForm.bulstatLabel"
                placeholderKey="contragentForm.bulstatPlaceholder"
                value={(formData as ContragentFormData).bulstat || ""}
                fieldName="bulstat"
                onChange={handleChange}
                onBlur={handleBlur}
                translations={translations}
                isRequired={true}
                error={
                  touchedFields.has("bulstat")
                    ? validationErrors.bulstat
                    : undefined
                }
              />
              <FormField
                labelKey="contragentForm.vatNumberLabel"
                placeholderKey="contragentForm.vatNumberPlaceholder"
                value={(formData as ContragentFormData).vatNumber || ""}
                fieldName="vatNumber"
                onChange={handleChange}
                onBlur={handleBlur}
                translations={translations}
                isRequired={true}
              />
              <FormField
                labelKey="contragentForm.molNameLabel"
                placeholderKey="contragentForm.molNamePlaceholder"
                value={(formData as ContragentFormData).molName || ""}
                fieldName="molName"
                onChange={handleChange}
                onBlur={handleBlur}
                translations={translations}
                isRequired={true}
              />
              <FormField
                labelKey="contragentForm.emailLabel"
                placeholderKey="contragentForm.emailPlaceholder"
                value={(formData as ContragentFormData).email || ""}
                fieldName="email"
                onChange={handleChange}
                onBlur={handleBlur}
                translations={translations}
                isRequired={false}
                error={
                  touchedFields.has("email")
                    ? validationErrors.email
                    : undefined
                }
              />
            </>
          ) : (
            <>
              {/* Organization fields */}
              <FormField
                labelKey="organizationForm.namePlaceholder"
                placeholderKey="organizationForm.namePlaceholder"
                value={(formData as OrganizationFormData).name}
                fieldName="name"
                onChange={handleChange}
                onBlur={handleBlur}
                translations={translations}
                isRequired
                error={
                  touchedFields.has("name") ? validationErrors.name : undefined
                }
              />
              <FormField
                labelKey="organizationForm.bulstatLabel"
                placeholderKey="organizationForm.bulstatPlaceholder"
                value={(formData as OrganizationFormData).bulstat || ""}
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
                value={(formData as OrganizationFormData).vatNumber || ""}
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
                value={(formData as OrganizationFormData).molName || ""}
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
                labelKey="organizationForm.emailLabel"
                placeholderKey="organizationForm.emailPlaceholder"
                value={(formData as OrganizationFormData).email || ""}
                fieldName="email"
                onChange={handleChange}
                onBlur={handleBlur}
                translations={translations}
                isRequired={false}
                error={
                  touchedFields.has("email")
                    ? validationErrors.email
                    : undefined
                }
              />
              <FormField
                labelKey="organizationForm.invoiceSeriesPrefixLabel"
                placeholderKey="organizationForm.invoiceSeriesPrefixPlaceholder"
                value={(formData as OrganizationFormData).invoiceSeriesPrefix}
                fieldName="invoiceSeriesPrefix"
                onChange={handleChange}
                onBlur={handleBlur}
                translations={translations}
                maxLength={10}
              />
            </>
          )}
        </div>
      </div>

      {/* Address Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          {isContragent
            ? translations("contragentForm.contragentAddressInformation")
            : translations("organizationForm.organizationAddressInformation")}
        </h3>
        <div className="grid lg:grid-cols-2 grid-cols-1 gap-4">
          <FormField
            labelKey={
              isContragent
                ? "contragentForm.countryLabel"
                : "organizationForm.countryLabel"
            }
            placeholderKey={
              isContragent
                ? "contragentForm.countryPlaceholder"
                : "organizationForm.countryPlaceholder"
            }
            value={formData.address.country || ""}
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
            labelKey={
              isContragent
                ? "contragentForm.regionLabel"
                : "organizationForm.regionLabel"
            }
            placeholderKey={
              isContragent
                ? "contragentForm.regionPlaceholder"
                : "organizationForm.regionPlaceholder"
            }
            value={formData.address.region || ""}
            fieldName="address.region"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
          />
          <FormField
            labelKey={
              isContragent
                ? "contragentForm.districtLabel"
                : "organizationForm.districtLabel"
            }
            placeholderKey={
              isContragent
                ? "contragentForm.districtPlaceholder"
                : "organizationForm.districtPlaceholder"
            }
            value={formData.address.district || ""}
            fieldName="address.district"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
          />
          <FormField
            labelKey={
              isContragent
                ? "contragentForm.municipalityLabel"
                : "organizationForm.municipalityLabel"
            }
            placeholderKey={
              isContragent
                ? "contragentForm.municipalityPlaceholder"
                : "organizationForm.municipalityPlaceholder"
            }
            value={formData.address.municipality || ""}
            fieldName="address.municipality"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
          />
          <FormField
            labelKey={
              isContragent
                ? "contragentForm.settlementLabel"
                : "organizationForm.settlementLabel"
            }
            placeholderKey={
              isContragent
                ? "contragentForm.settlementPlaceholder"
                : "organizationForm.settlementPlaceholder"
            }
            value={formData.address.settlement || ""}
            fieldName="address.settlement"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
          />
          <FormField
            labelKey={
              isContragent
                ? "contragentForm.areaLabel"
                : "organizationForm.areaLabel"
            }
            placeholderKey={
              isContragent
                ? "contragentForm.areaPlaceholder"
                : "organizationForm.areaPlaceholder"
            }
            value={formData.address.area || ""}
            fieldName="address.area"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
          />
          <FormField
            labelKey={
              isContragent
                ? "contragentForm.streetLabel"
                : "organizationForm.streetLabel"
            }
            placeholderKey={
              isContragent
                ? "contragentForm.streetPlaceholder"
                : "organizationForm.streetPlaceholder"
            }
            value={formData.address.street || ""}
            fieldName="address.street"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
          />
          <FormField
            labelKey={
              isContragent
                ? "contragentForm.streetNumberLabel"
                : "organizationForm.streetNumberLabel"
            }
            placeholderKey={
              isContragent
                ? "contragentForm.streetNumberPlaceholder"
                : "organizationForm.streetNumberPlaceholder"
            }
            value={formData.address.streetNumber || ""}
            fieldName="address.streetNumber"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
          />
          <FormField
            labelKey={
              isContragent
                ? "contragentForm.blockLabel"
                : "organizationForm.blockLabel"
            }
            placeholderKey={
              isContragent
                ? "contragentForm.blockPlaceholder"
                : "organizationForm.blockPlaceholder"
            }
            value={formData.address.block || ""}
            fieldName="address.block"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
          />
          <FormField
            labelKey={
              isContragent
                ? "contragentForm.entranceLabel"
                : "organizationForm.entranceLabel"
            }
            placeholderKey={
              isContragent
                ? "contragentForm.entrancePlaceholder"
                : "organizationForm.entrancePlaceholder"
            }
            value={formData.address.entrance || ""}
            fieldName="address.entrance"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
          />
          <FormField
            labelKey={
              isContragent
                ? "contragentForm.floorLabel"
                : "organizationForm.floorLabel"
            }
            placeholderKey={
              isContragent
                ? "contragentForm.floorPlaceholder"
                : "organizationForm.floorPlaceholder"
            }
            value={formData.address.floor || ""}
            fieldName="address.floor"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
          />
          <FormField
            labelKey={
              isContragent
                ? "contragentForm.apartmentLabel"
                : "organizationForm.apartmentLabel"
            }
            placeholderKey={
              isContragent
                ? "contragentForm.apartmentPlaceholder"
                : "organizationForm.apartmentPlaceholder"
            }
            value={formData.address.apartment || ""}
            fieldName="address.apartment"
            onChange={handleChange}
            onBlur={handleBlur}
            translations={translations}
          />
          <FormField
            labelKey={
              isContragent
                ? "contragentForm.postCodeLabel"
                : "organizationForm.postCodeLabel"
            }
            placeholderKey={
              isContragent
                ? "contragentForm.postCodePlaceholder"
                : "organizationForm.postCodePlaceholder"
            }
            value={formData.address.postCode || ""}
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
