import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddonGroups from "../AddonGroups";
import type { AddonGroup } from "../../utils/types";

describe("AddonGroups boolean string props", () => {
  it('treats "false" string as false (single choice)', async () => {
    const addons: AddonGroup[] = [
      {
        id: "1",
        group_id: "1",
        name: "Size",
        required: false,
        multiple_choice: "false" as unknown as any,
        max_option_quantity: 1,
        addon_options: [
          { id: "a", name: "Small", price: 0 },
          { id: "b", name: "Large", price: 0 },
        ],
      },
    ];

    const { container } = render(<AddonGroups addons={addons} />);

    const small = screen.getByText("Small");
    const large = screen.getByText("Large");

    await userEvent.click(small);
    await userEvent.click(large);

    const selected = container.querySelectorAll("[data-selected='true']");
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent("Large");
  });

  it('treats "true" string as true and enforces caps', async () => {
    const addons: AddonGroup[] = [
      {
        id: "1",
        group_id: "1",
        name: "Extras",
        required: false,
        multiple_choice: "true" as unknown as any,
        max_group_select: 1,
        max_option_quantity: 2,
        addon_options: [
          { id: "a", name: "Cheese", price: 0 },
          { id: "b", name: "Bacon", price: 0 },
        ],
      },
    ];

    render(<AddonGroups addons={addons} />);

    const cheese = screen.getByText("Cheese");
    const bacon = screen.getByText("Bacon");

    await userEvent.click(cheese);
    await userEvent.click(bacon);
    await userEvent.click(bacon);

    // group cap reached - cheese quantity should remain 1
    const qtySpans = screen.getAllByText("1");
    expect(qtySpans.length).toBe(1);
  });
});
