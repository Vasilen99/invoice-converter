type Props = {
  addServiceStepsDivider?: boolean;
  pricingPageDivider?: boolean;
};
const DividerComponent = ({
  addServiceStepsDivider,
  pricingPageDivider,
}: Props) => {
  return (
    <hr
      className={`${pricingPageDivider ? "my-4 border-base-100!" : ""} ${addServiceStepsDivider ? "mx-4 mt-5 bg-primary border-transparent!" : "border-base-200"} h-0.5  rounded-full  w-full`}
    />
  );
};

export default DividerComponent;
