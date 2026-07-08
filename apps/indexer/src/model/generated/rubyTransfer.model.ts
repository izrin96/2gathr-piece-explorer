import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, Index as Index_, BigIntColumn as BigIntColumn_, DateTimeColumn as DateTimeColumn_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class RubyTransfer {
    constructor(props?: Partial<RubyTransfer>) {
        Object.assign(this, props)
    }

    /**
     * `${blockNumber}-${logIndex}`
     */
    @PrimaryColumn_()
    id!: string

    @Index_("idx_ruby_transfer_from_1c95d546")
    @StringColumn_({nullable: false})
    from!: string

    @Index_("idx_ruby_transfer_to_dcb8b618")
    @StringColumn_({nullable: false})
    to!: string

    @BigIntColumn_({nullable: false})
    value!: bigint

    @Index_("idx_ruby_transfer_timestamp_18d85315")
    @DateTimeColumn_({nullable: false})
    timestamp!: Date

    @Index_("idx_ruby_transfer_block_number_79876a55")
    @IntColumn_({nullable: false})
    blockNumber!: number

    @IntColumn_({nullable: false})
    logIndex!: number

    @Index_("idx_ruby_transfer_hash_62355050")
    @StringColumn_({nullable: false})
    hash!: string
}
