"use client";

import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { OrganizationFormData } from "../../utility/types";
import type { AbstractIntlMessages } from "next-intl";

interface FormFieldProps {
  labelKey: string;
  placeholderKey: string;
  value: string;
  fieldName: string;
  onChange: (field: string, value: string) => void;
  translations: ReturnType<typeof import("next-intl").useTranslations>;
  maxLength?: number;
}

function FormField({
  labelKey,
  placeholderKey,
  value,
  fieldName,
  onChange,
  translations,
  maxLength,
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-3 items-start">
      <Label>{translations(labelKey)}</Label>
      <Input
        placeholder={translations(placeholderKey)}
        value={value}
        onChange={(e) => onChange(fieldName, e.target.value)}
        maxLength={maxLength}
      />
    </div>
  );
}

export default function ManualAddOrganization({
  formData,
  setFormData,
  translations,
}: {
  formData: OrganizationFormData;
  setFormData: React.Dispatch<React.SetStateAction<OrganizationFormData>>;
  translations: ReturnType<typeof import("next-intl").useTranslations>;
}) {
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
  };

  return (
    <div className="space-y-6 max-h-[60vh] p-4 overflow-y-auto">
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
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.bulstatLabel"
            placeholderKey="organizationForm.bulstatPlaceholder"
            value={formData.bulstat}
            fieldName="bulstat"
            onChange={handleChange}
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.vatNumberLabel"
            placeholderKey="organizationForm.vatNumberPlaceholder"
            value={formData.vatNumber}
            fieldName="vatNumber"
            onChange={handleChange}
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.molNameLabel"
            placeholderKey="organizationForm.molNamePlaceholder"
            value={formData.molName}
            fieldName="molName"
            onChange={handleChange}
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.invoiceSeriesPrefixLabel"
            placeholderKey="organizationForm.invoiceSeriesPrefixPlaceholder"
            value={formData.invoiceSeriesPrefix}
            fieldName="invoiceSeriesPrefix"
            onChange={handleChange}
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
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.regionLabel"
            placeholderKey="organizationForm.regionPlaceholder"
            value={formData.address.region}
            fieldName="address.region"
            onChange={handleChange}
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.districtLabel"
            placeholderKey="organizationForm.districtPlaceholder"
            value={formData.address.district}
            fieldName="address.district"
            onChange={handleChange}
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.municipalityLabel"
            placeholderKey="organizationForm.municipalityPlaceholder"
            value={formData.address.municipality}
            fieldName="address.municipality"
            onChange={handleChange}
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.settlementLabel"
            placeholderKey="organizationForm.settlementPlaceholder"
            value={formData.address.settlement}
            fieldName="address.settlement"
            onChange={handleChange}
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.areaLabel"
            placeholderKey="organizationForm.areaPlaceholder"
            value={formData.address.area}
            fieldName="address.area"
            onChange={handleChange}
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.streetLabel"
            placeholderKey="organizationForm.streetPlaceholder"
            value={formData.address.street}
            fieldName="address.street"
            onChange={handleChange}
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.streetNumberLabel"
            placeholderKey="organizationForm.streetNumberPlaceholder"
            value={formData.address.streetNumber}
            fieldName="address.streetNumber"
            onChange={handleChange}
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.blockLabel"
            placeholderKey="organizationForm.blockPlaceholder"
            value={formData.address.block}
            fieldName="address.block"
            onChange={handleChange}
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.entranceLabel"
            placeholderKey="organizationForm.entrancePlaceholder"
            value={formData.address.entrance}
            fieldName="address.entrance"
            onChange={handleChange}
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.floorLabel"
            placeholderKey="organizationForm.floorPlaceholder"
            value={formData.address.floor}
            fieldName="address.floor"
            onChange={handleChange}
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.apartmentLabel"
            placeholderKey="organizationForm.apartmentPlaceholder"
            value={formData.address.apartment}
            fieldName="address.apartment"
            onChange={handleChange}
            translations={translations}
          />
          <FormField
            labelKey="organizationForm.postCodeLabel"
            placeholderKey="organizationForm.postCodePlaceholder"
            value={formData.address.postCode}
            fieldName="address.postCode"
            onChange={handleChange}
            translations={translations}
          />
        </div>
      </div>
    </div>
  );
}
